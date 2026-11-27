// Spielbildschirm: verbindet den reinen Spielzustand (lib/games/sokoban/state.ts) mit dem statischen HTML aus
// KistenschieberGame.astro. Tasten, Tippen, Wischen, Steuerkreuz, Knöpfe und Takt erzeugen neue Zustände; danach zeigt
// der Bildschirm Zähler, Schild und Knöpfe nach dem Sieg und zeichnet das Feld. Nebenwirkungen eines Zustandswechsels
// macht nur diese Datei: Bestwert und „mit Lösung gesehen“ speichern, Konfetti werfen (nicht bei weniger Bewegung, nie
// nach vorgespielter Lösung) und wieder wegnehmen, Töne auslösen (welche, entscheidet ks-sound.ts).
// Das Menü (statischer <dialog>) öffnet und verdrahtet der Kern selbst: Während einer Lektion ist es der einzige Weg zu
// Levelwahl, Einstellungen und Lösung, es darf also nie am Nachladen hängen. Nur das Konfetti kommt aus dem
// nachgeladenen Teil ks-menu.ts: Er wird geholt, sobald eine Lektion offen ist; ein Sieg davor bekommt es dann.
import { screenDirs } from '../../lib/games/oblique/camera';
import { type Hits, pick } from '../../lib/games/oblique/geometry';
import { later } from '../../lib/games/later';
import { type DirKey, type Level, DIRS, parseLevel } from '../../lib/games/sokoban/level';
import { markOpened, markShown, markSkipped, recordWin } from '../../lib/games/sokoban/progress';
import { type Particle, decoFor, gameWorld } from '../../lib/games/sokoban/scene';
import {
  type Game,
  again,
  busy,
  key,
  msgKind,
  newGame,
  restart,
  showSolution,
  stopAuto,
  tick,
  tip,
  undo,
} from '../../lib/games/sokoban/state';
import { KAJE_DECO } from '../../data/games/kaje';
import { LESSONS, type Lesson } from '../../data/games/lessons';
import { countText, fieldLabel, lessonName, nextText, signText } from '../../data/games/texts';
import { type KeyAction, keepsKey, keyAction, padAngles, swipeDir, tapAt } from './ks-input';
import { nextHash } from './ks-router';
import { type Cue, cues } from './ks-sound';
import { type GameMoment, SAFE_EVENT, WIN_MS } from './pwa-moment';
import type { Host } from './ks-screens';
import { renderWorld } from './render/world';

/** Unter dieser Breite (CSS-px) fällt der Wasserrand weg */
const NO_RING_BELOW = 560;

type Extras = typeof import('./ks-menu');

function need<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Kistenschieber: ${sel} fehlt`);
  return el;
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Was die Browser-Tests antippen: ein Bodenfeld oder eine Kiste */
export type Spot = { readonly r: number; readonly c: number } | { readonly crate: number };

export class GameScreen {
  private readonly gin: HTMLElement;
  private readonly title: HTMLElement;
  private readonly count: HTMLElement;
  private readonly field: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly sign: HTMLElement;
  private readonly next: HTMLAnchorElement;
  private readonly again: HTMLButtonElement;
  private readonly msg: HTMLElement;
  private readonly offer: HTMLButtonElement;
  private readonly dialog: HTMLDialogElement;
  private readonly menuTitle: HTMLElement;
  private readonly pad: HTMLElement;
  private lesson: Lesson = LESSONS[0]!;
  private L: Level = parseLevel(this.lesson.xsb);
  private g: Game = newGame(this.L);
  private fx: Particle[] = [];
  private deco = decoFor(this.L, KAJE_DECO);
  private hits: Hits | null = null;
  private down: { readonly x: number; readonly y: number; readonly id: number } | null = null;
  /** Sieg mit Konfetti, bevor der nachgeladene Teil da war */
  private burstWanted = false;
  /** Beginn des letzten Schritts mit Ton (Zeit des Spiels, ms) */
  private lastStep = -Infinity;
  private readonly extras: (want: unknown) => Extras | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly host: Host,
    /** neu zeichnen lassen (im nächsten Bild, mit Test-Uhr sofort) */
    private readonly request: () => void,
    signal: AbortSignal,
    /** Töne spielen (sfx.ts) */
    private readonly sound: (cues: readonly Cue[]) => void,
  ) {
    this.gin = need(root, '.gin');
    this.title = need(root, '[data-ks="title"]');
    this.count = need(root, '[data-ks="count"]');
    this.field = need(root, '.field');
    this.canvas = need(this.field, 'canvas');
    this.sign = need(root, '[data-ks="sign"]');
    this.msg = need(root, '.gmsg');
    this.next = need(root, '[data-ks="next"]');
    this.again = need(root, '[data-ks="again"]');
    this.offer = need(root, '[data-ks="offer"]');
    this.dialog = need(root, 'dialog.menu');
    this.menuTitle = need(this.dialog, 'h2');
    this.pad = need(root, '.pad');
    this.extras = later(() =>
      import('./ks-menu').then((m) => {
        this.loaded(m);
        return m;
      }),
    );
    const on = (sel: string, fn: () => void) => need(root, sel).addEventListener('click', fn, { signal });
    on('[data-ks="undo"]', () => this.apply(undo(this.g)));
    on('[data-ks="tip"]', () => this.apply(tip(this.g)));
    on('[data-ks="again"]', () => this.apply(again(this.g)));
    on('[data-ks="offer"]', () => this.skip());
    on('[data-ks="menu"]', () => this.openMenu());
    // Menü: jeder Knopf schließt es und tut dann seins; die Links wechseln den Bildschirm (leave() schließt es ohnehin)
    const menu: Record<string, () => void> = {
      resume: () => this.focus(),
      restart: () => this.apply(restart(this.g)),
      tip: () => this.apply(tip(this.g)),
      solution: () => this.apply(showSolution(this.g, performance.now())),
      skip: () => this.skip(),
    };
    for (const b of this.dialog.querySelectorAll<HTMLButtonElement>('button[data-menu]'))
      b.addEventListener(
        'click',
        () => {
          this.dialog.close();
          menu[b.dataset.menu ?? '']?.();
        },
        { signal },
      );
    for (const a of this.dialog.querySelectorAll('a'))
      a.addEventListener('click', () => this.dialog.close(), { signal });
    for (const b of this.pad.querySelectorAll<HTMLButtonElement>('button[data-pad]'))
      b.addEventListener('click', () => this.walk(b.dataset.pad as DirKey), { signal });
    // Antippen und Wischen über Pointer-Events: kurzer Weg = Tippen, langer = ein Schritt in Wischrichtung
    const cv = this.canvas;
    const opts = { signal };
    cv.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY, id: e.pointerId }), opts);
    cv.addEventListener('pointercancel', () => (this.down = null), opts);
    cv.addEventListener('pointerup', (e) => this.pointerUp(e), opts);
  }

  /** Lektion n (frei) öffnen: neues Spiel, als letzte gemerkt, Texte der Lektion; den nachgeladenen Teil holen */
  enter(n: number) {
    this.lesson = LESSONS[n - 1] ?? LESSONS[0]!;
    this.L = parseLevel(this.lesson.xsb);
    this.deco = decoFor(this.L, KAJE_DECO);
    this.g = newGame(this.L, { sol: this.lesson.sol, reduce: reduced() });
    this.fx = [];
    this.burstWanted = false;
    this.hits = null;
    markOpened(this.host.kv, n);
    const name = lessonName(this.lesson);
    this.title.textContent = name;
    this.menuTitle.textContent = name;
    this.canvas.setAttribute('aria-label', fieldLabel(this.lesson));
    this.next.href = nextHash(n, LESSONS.length);
    this.next.textContent = nextText(n);
    this.gin.classList.toggle('left', this.host.settings().hand === 'links');
    // Pfeile des Steuerkreuzes in die Bildschirmrichtung der Kamera drehen
    const angles = padAngles(screenDirs(this.host.camera()));
    for (const b of this.pad.querySelectorAll<HTMLElement>('button[data-pad]')) {
      const svg = b.querySelector('svg');
      if (svg) svg.style.transform = `rotate(${angles[b.dataset.pad as DirKey]}deg)`;
    }
    this.sync();
    this.extras(true);
  }

  /** Für Updates der App (pwa-update.ts): „Geschafft!“ (selbst gelöst), Menü offen, wohin es danach weitergeht */
  moment(): Pick<GameMoment, 'won' | 'menuOpen' | 'resume'> {
    const won = this.g.won && !this.g.shownWin;
    return { won, menuOpen: this.dialog.open, resume: won ? nextHash(this.lesson.n, LESSONS.length) : null };
  }

  /** Den Bildschirm verlassen: ein offenes Menü schließen */
  leave() {
    if (this.dialog.open) this.dialog.close();
  }

  /** Fokus fürs Spielen: auf das Feld (Bildschirmleser lesen Titel und Bedienung) */
  focus() {
    this.canvas.focus({ preventScroll: true });
  }

  /** Taste (keydown auf window); nur aufgerufen, solange das Spielfeld zu sehen ist */
  onKey(e: KeyboardEvent) {
    const t = e.target instanceof Element ? e.target : null;
    const a = keyAction(
      {
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        inField: !!t?.closest('input, select, textarea'),
        onControl: !!t?.closest('button, a'),
        dialogOpen: !!document.querySelector('dialog[open]'),
      },
      this.g.won,
    );
    if (!a) return;
    if (keepsKey(a)) e.preventDefault();
    this.act(a);
  }

  private act(a: KeyAction) {
    const g = this.g;
    if (a.kind === 'step') this.walk(a.d);
    else if (a.kind === 'undo') this.apply(undo(g));
    else if (a.kind === 'restart') this.apply(restart(g));
    else if (a.kind === 'tip') this.apply(tip(g));
    else if (a.kind === 'menu') this.openMenu();
    else if (a.kind === 'escape') {
      // Erst die Auswahl aufheben, sonst das Menü (nach dieser Taste, sonst schließt Esc es gleich wieder)
      if (g.sel !== null) this.apply({ ...g, sel: null, hint: null });
      else setTimeout(() => this.openMenu(), 0);
    } else if (a.kind === 'next') location.hash = nextHash(this.lesson.n, LESSONS.length);
    else if (g.auto) this.apply(stopAuto(g));
  }

  /** Ein Schritt (Taste, Wischen, Steuerkreuz); beendet ein Vorspielen */
  private walk(d: DirKey) {
    this.apply(key(this.g, DIRS[d], performance.now()));
  }

  private pointerUp(e: PointerEvent) {
    const down = this.down;
    if (!down || down.id !== e.pointerId) return;
    this.down = null;
    const d = swipeDir(e.clientX - down.x, e.clientY - down.y, screenDirs(this.host.camera()));
    if (d) return this.walk(d);
    // Erst zeichnen: Hat sich das Feld eben verschoben (Steuerkreuz nach dem ersten Antippen), passen die Treffer
    const now = performance.now();
    this.draw(now);
    const r = this.canvas.getBoundingClientRect();
    this.apply(tapAt(this.g, pick(this.hits, e.clientX - r.left, e.clientY - r.top), now), now);
  }

  /**
   * Für die Browser-Tests: ein Punkt (Seitenkoordinaten), an dem Antippen genau dieses Bodenfeld (nicht von Kiste
   * oder Figur verdeckt) oder diese Kiste trifft; null, wenn es keinen gibt
   */
  spot(s: Spot): { x: number; y: number } | null {
    const hits = this.hits;
    if (!hits) return null;
    const crate = 'crate' in s;
    const poly = crate
      ? hits.objs.find((o) => o.type === 'crate' && o.id === s.crate)?.poly
      : hits.floors.find((f) => f.r === s.r && f.c === s.c)?.poly;
    if (!poly?.length) return null;
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const r = this.canvas.getBoundingClientRect();
    // von der Mitte nach außen
    const steps = [5, 4, 6, 3, 7, 2, 8].map((v) => v / 10);
    for (const fy of steps)
      for (const fx of steps) {
        const x = x0 + (x1 - x0) * fx;
        const y = y0 + (y1 - y0) * fy;
        const p = pick(hits, x, y);
        const ok = crate ? p?.type === 'crate' && p.id === s.crate : p?.type === 'floor' && p.r === s.r && p.c === s.c;
        if (ok) return { x: r.left + x, y: r.top + y };
      }
    return null;
  }

  /** Menü öffnen (Knopf, M, Esc): beendet ein Vorspielen */
  private openMenu() {
    if (this.dialog.open) return;
    if (this.g.auto) this.apply(stopAuto(this.g));
    this.dialog.showModal();
  }

  /** Der nachgeladene Teil ist da: ein Sieg davor bekommt jetzt sein Konfetti */
  private loaded(m: Extras) {
    this.root.classList.add('extras');
    if (this.burstWanted) {
      this.burstWanted = false;
      if (this.g.won && this.g.confetti && !this.g.reduce) this.fx = m.burst(this.L, this.g.boxes, performance.now());
      this.request();
    }
  }

  /** „Lektion überspringen“, „Zu knifflig? Überspringen“: merken (nur ohne Bestwert) und weiter */
  private skip() {
    markSkipped(this.host.kv, this.lesson.n);
    location.hash = nextHash(this.lesson.n, LESSONS.length);
  }

  /** Neuer Zustand: Nebenwirkungen, Anzeige, neu zeichnen */
  private apply(next: Game, now = performance.now()) {
    const prev = this.g;
    this.g = next;
    this.effects(prev, now);
    this.sync();
    this.request();
  }

  private effects(prev: Game, now: number) {
    const g = this.g;
    const { kv } = this.host;
    const heard = cues(prev, g, this.lastStep);
    this.lastStep = heard.lastStep;
    if (heard.cues.length) this.sound(heard.cues);
    if (g.solutionShown && !prev.solutionShown) markShown(kv, this.lesson.n);
    if (g.won && !prev.won) {
      recordWin(kv, this.lesson.n, { moves: g.moves, pushes: g.pushes, shown: g.shownWin });
      // Selbst gelöst: ein sicherer Moment für eine neue Version der App, wenn das Konfetti verflogen ist (pwa-register.ts)
      if (!g.shownWin)
        this.root.dispatchEvent(new CustomEvent(SAFE_EVENT, { bubbles: true, detail: { after: WIN_MS } }));
      if (g.confetti && !g.reduce) {
        const x = this.extras(true);
        if (x) this.fx = x.burst(this.L, g.boxes, now);
        else this.burstWanted = true;
      }
    }
    if (!g.confetti) {
      this.fx = [];
      this.burstWanted = false;
    }
  }

  /** Zähler, Schild (nur bei Änderung, damit der Bildschirmleser nichts doppelt ansagt) und Knöpfe nach dem Sieg */
  private sync() {
    const g = this.g;
    const active = document.activeElement;
    const had = active && this.msg.contains(active) ? active : null;
    this.count.textContent = countText(g.moves);
    const text = signText(g.msg, this.lesson, g.moves);
    if (this.sign.textContent !== text) this.sign.textContent = text;
    const kind = msgKind(g.msg);
    this.sign.className = kind ? `sign ${kind}` : 'sign';
    this.next.hidden = !g.won;
    this.again.hidden = !g.won;
    this.offer.hidden = g.won || !g.offered;
    // Ein eben versteckter Knopf (Nochmal, Weiter) hatte den Fokus: zurück aufs Feld statt auf <body>
    // (Chromium nimmt ihm den Fokus schon beim Verstecken, daher vorher merken)
    if (had instanceof HTMLElement && had.hidden) this.focus();
  }

  /** Ein Bild: Takt des Spiels, Konfetti, Feld zeichnen. true = es läuft noch etwas, weitere Bilder nötig */
  frame(now: number): boolean {
    const prev = this.g;
    this.g = tick(prev, now);
    if (this.g !== prev) {
      this.effects(prev, now);
      this.sync();
    }
    const x = this.extras(false);
    if (this.fx.length && x) this.fx = x.stepParticles(this.fx, now);
    this.draw(now);
    return busy(this.g) || this.fx.length > 0;
  }

  private draw(now: number) {
    const f = this.field;
    const world = gameWorld(this.g, now, { deco: this.deco, fx: this.fx });
    this.hits = renderWorld(this.canvas, world, this.host.camera(), {
      maxS: 1.6,
      maxH: Math.max(140, f.clientHeight - 6),
      noRing: f.clientWidth < NO_RING_BELOW,
      pad: 4,
    }).hits;
  }
}
