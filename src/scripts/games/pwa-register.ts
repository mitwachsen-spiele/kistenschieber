// Das Spiel als App: meldet den Service Worker an (nachgeladen von KistenschieberGame.astro, nur im Build). Er
// speichert das Spiel, damit es auch ohne Netz startet. Fehler bleiben still, das Spiel läuft auch ohne.
// Als installierte App bittet die Seite still um dauerhaften Speicher (schützt die Spielstände); im Browser-Tab nicht,
// weil manche Browser dort nachfragen würden.
//
// Neue Versionen: Eine installierte App wird meist nur angehalten und beim Tipp aufs Symbol fortgesetzt, ohne neu zu
// laden – eine wartende Version käme so wochenlang nicht an. Darum übernimmt die Seite sie selbst, aber nur in einem
// sicheren Moment (Entscheidungen rein und getestet in pwa-update.ts): Startbildschirm, Levelwahl, Einstellungen oder
// „Geschafft!“. Auslöser: ein sicherer Moment beginnt (das Spiel meldet `SAFE_EVENT`), die Seite startet in einem,
// oder sie kommt nach langer Pause zurück. Dann fragt sie nach einer neuen Version, bittet eine wartende um
// skipWaiting und lädt einmal neu, sobald diese die Seite übernimmt – aber nur, wenn der Moment dann noch sicher ist
// (das Kind kann dazwischen eine Lektion öffnen); sonst erst beim nächsten Auslöser in einem sicheren Moment. Nach
// „Geschafft!“ kommt die Seite mit der nächsten Lektion zurück, wie nach „Weiter“. Mitten in einer Lektion wird nie
// neu geladen, das Kind sieht keinen Hinweis, Eltern müssen nichts tun.
import { SERVICE_WORKER } from '../../data/pwa';
import { browserStore } from './browser-store';
import {
  SAFE_EVENT,
  longPause,
  registrationOptions,
  safeMoment,
  shouldApply,
  shouldReload,
  type GameMoment,
} from './pwa-update';

/** Zuletzt übernommen (sessionStorage, übersteht das Neuladen): gegen eine Schleife von Neuladen */
const APPLIED_KEY = 'kistenschieber.updated';

/** Was das Spiel dafür anbietet (ks-kistenschieber.ts) */
type Game = Element & { updateMoment(): GameMoment };
const game = (): Game | null => {
  const el = document.querySelector('ks-kistenschieber');
  return el && 'updateMoment' in el ? (el as Game) : null;
};

const lastApplied = () => {
  try {
    return Number(sessionStorage.getItem(APPLIED_KEY)) || 0;
  } catch {
    return 0;
  }
};
const remember = (now: number) => {
  try {
    sessionStorage.setItem(APPLIED_KEY, String(now));
  } catch {
    /* dann schützt nur der Merker der Seite */
  }
};

/** Übernimmt wartende Versionen an sicheren Stellen */
function watchUpdates(reg: ServiceWorkerRegistration) {
  let armedAt = 0; // letzter Auslöser
  let hiddenAt = 0; // seit wann die Seite verborgen ist
  let applying = false; // um skipWaiting gebeten, die Übernahme steht aus
  let taken = false; // die neue Version steuert die Seite, neu geladen wird im nächsten sicheren Moment

  const moment = () => game()?.updateMoment() ?? null;
  const safeNow = () => {
    const inGame = moment();
    return (
      !!inGame &&
      safeMoment({
        ...inGame,
        persistent: browserStore().persistent, // ohne localStorage ginge der Spielstand mit dem Neuladen verloren
        visible: document.visibilityState === 'visible',
      })
    );
  };
  const tryReload = () => {
    if (!shouldReload({ taken, safe: safeNow(), armedAt, now: Date.now() })) return;
    taken = false;
    // Nach „Geschafft!“ weiter mit der nächsten Lektion, sonst derselbe Bildschirm
    const resume = moment()?.resume;
    if (resume) history.replaceState(history.state, '', resume);
    location.reload();
  };
  const tryApply = () => {
    const waiting = reg.waiting;
    if (applying || taken || !waiting || !navigator.serviceWorker.controller) return;
    const now = Date.now();
    if (!shouldApply({ waiting: true, armedAt, lastApplied: lastApplied(), now, safe: safeNow() })) return;
    applying = true;
    remember(now);
    waiting.postMessage({ type: 'skip-waiting' });
  };
  const trigger = () => {
    armedAt = Date.now();
    tryReload();
    tryApply();
    // Nach einer neuen Version fragen; ist eine da, lädt sie im Hintergrund und meldet sich über updatefound
    reg.update().then(tryApply, () => {});
  };

  /** Ist die Version, die gerade lädt, fertig, zählt sie noch, solange das Fenster nach einem Auslöser offen ist */
  const watch = (next: ServiceWorker | null) =>
    next?.addEventListener('statechange', () => {
      if (next.state === 'installed') tryApply();
    });
  // Lädt beim Anmelden schon eine (der Browser fragt beim Aufruf der Seite selbst nach), kam ihr updatefound vor uns
  watch(reg.installing);
  reg.addEventListener('updatefound', () => watch(reg.installing));
  // Nur wenn die Seite selbst darum gebeten hat: Beim allerersten Besuch übernimmt clients.claim() die Seite auch.
  // Zwischen Bitte und Übernahme kann das Kind eine Lektion geöffnet haben: dann noch nicht, erst beim nächsten Auslöser
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applying) return;
    applying = false;
    taken = true;
    tryReload();
  });
  // 1. Ein sicherer Moment beginnt (Bildschirm gewechselt, „Geschafft!“ nach dem Konfetti)
  document.addEventListener(SAFE_EVENT, (e) => {
    const after = (e as CustomEvent<{ after?: number } | null>).detail?.after ?? 0;
    setTimeout(trigger, after);
  });
  // 2. Zurück nach langer Pause
  document.addEventListener('visibilitychange', () => {
    const now = Date.now();
    if (document.visibilityState === 'hidden') hiddenAt = now;
    else {
      if (longPause(hiddenAt, now)) trigger();
      hiddenAt = 0;
    }
  });
  // 3. Die Seite startet in einem sicheren Moment (auch nach einem Neuladen von Hand)
  if (safeNow()) trigger();
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const start = () => {
    navigator.serviceWorker
      .register(SERVICE_WORKER.url, registrationOptions(SERVICE_WORKER.scope))
      .then((reg) => {
        watchUpdates(reg);
        // Die Seite meldet sich: Ist sie die einzige Spielseite, räumt der Service Worker alte Caches weg
        navigator.serviceWorker.controller?.postMessage({ type: 'tidy' });
      })
      .catch(() => {});
    const installed =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed) navigator.storage?.persist?.().catch(() => {});
  };
  // Erst nach dem Laden: Das Spiel startet zuerst
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}
