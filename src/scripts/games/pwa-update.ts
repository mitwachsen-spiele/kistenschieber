// Neue Version der App an sicheren Stellen übernehmen – rein, ohne DOM und ohne Uhr, damit testbar.
// Installierte Apps (Handy, Tablet) werden meist nur angehalten, nicht beendet: Ein Tipp aufs Symbol setzt sie fort,
// ohne neu zu laden. Der Browser prüft dann weder auf eine neue Version, noch wird eine wartende aktiv. Darum übernimmt
// das Spiel eine wartende Version selbst, aber nur in einem sicheren Moment, in dem Neuladen nichts kostet:
// – auf dem Startbildschirm, in der Levelwahl (auch „Diese Lektion ist noch zu“) und in den Einstellungen,
// – nach „Geschafft!“: Die Lektion ist gelöst, der Bestwert gespeichert. Die Seite kommt dann mit der nächsten Lektion
//   zurück, wie nach „Weiter“ (`resume`).
// Mitten in einer Lektion nie, auch nicht nach vorgespielter Lösung, nie bei offenem Menü und nie ohne dauerhaften
// Speicher. Auslöser: ein sicherer Moment beginnt (`SAFE_EVENT`), die Seite startet in einem, oder sie kommt nach langer
// Pause zurück. Nach einem Auslöser bleibt ein kurzes Fenster offen, damit eine Version, die erst jetzt geladen wird,
// noch zählt. Spezifikation: docs/specs/kistenschieber.md („App“).

import type { Moment } from './pwa-moment';

// Daten und Typen, die auch der Kern braucht, stehen in pwa-moment.ts
export { SAFE_EVENT, WIN_MS, type GameMoment, type Moment, type Screen } from './pwa-moment';

const MIN = 60_000;
export const LONG_PAUSE = 30 * MIN; // so lange verborgen, und beim Zurückkommen wird nach einer neuen Version gefragt
export const ARM_MS = 60_000; // so lange nach einem Auslöser darf eine (gerade erst geladene) Version übernommen werden
export const APPLY_GAP = 10 * MIN; // höchstens einmal in dieser Zeit neu laden – keine Schleife, falls etwas klemmt

/** Ist jetzt ein sicherer Moment? Nach dem Neuladen geht nichts verloren */
export function safeMoment(m: Moment): boolean {
  if (!m.persistent || !m.visible || m.menuOpen) return false;
  return m.screen === 'spiel' ? m.won : true;
}

/** War die Seite lange genug verborgen? (`hiddenAt` 0: war sie nicht) */
export const longPause = (hiddenAt: number, now: number): boolean => hiddenAt > 0 && now - hiddenAt >= LONG_PAUSE;

export type Chance = {
  waiting: boolean; // eine neue Version wartet
  armedAt: number; // Zeitpunkt des letzten Auslösers, 0: keiner
  lastApplied: number; // wann zuletzt eine Version übernommen wurde (über das Neuladen hinweg), 0: nie
  now: number;
  safe: boolean; // safeMoment(…)
};

/** Jetzt übernehmen und neu laden? */
export function shouldApply(c: Chance): boolean {
  if (!c.waiting || !c.safe || c.armedAt <= 0) return false;
  if (c.now - c.armedAt > ARM_MS || c.now < c.armedAt) return false;
  return c.lastApplied <= 0 || c.now - c.lastApplied >= APPLY_GAP || c.now < c.lastApplied;
}

export type Takeover = {
  taken: boolean; // die neue Version steuert die Seite, auf Bitte der Seite (controllerchange nach skipWaiting)
  safe: boolean; // safeMoment(…), jetzt erneut geprüft
  armedAt: number; // Zeitpunkt des letzten Auslösers, 0: keiner
  now: number;
};

/**
 * Jetzt neu laden? Zwischen der Bitte um skipWaiting und der Übernahme vergeht Zeit (ein ruhender Service Worker
 * startet auf dem Handy erst), und das Kind kann genau dann eine Lektion öffnen. Darum gilt der sichere Moment noch
 * einmal: Ist er vorbei, lädt die Seite erst beim nächsten Auslöser in einem sicheren Moment neu. Bis dahin spielt
 * sie weiter, die neue Version liefert ihr die alten Dateien aus dem alten Cache (Aufräumen wartet auf offene Seiten).
 */
export function shouldReload(t: Takeover): boolean {
  if (!t.taken || !t.safe || t.armedAt <= 0) return false;
  return t.now >= t.armedAt && t.now - t.armedAt <= ARM_MS;
}

/**
 * Optionen der Anmeldung. `updateViaCache: 'none'`: Die Frage nach einer neuen Version geht immer am HTTP-Cache vorbei
 * ins Netz, für sw.js und alles, was er einmal importieren sollte. Nie 'all' – dann hielte der HTTP-Cache eine neue
 * Version zurück, und alle Mühe an den sicheren Stellen ginge ins Leere.
 */
export const registrationOptions = (scope: string): RegistrationOptions => ({ scope, updateViaCache: 'none' });
