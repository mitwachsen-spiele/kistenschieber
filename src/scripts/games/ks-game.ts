// Spielbildschirm: verbindet den reinen Spielzustand (lib/games/sokoban/state.ts) mit dem statischen HTML aus
// KistenschieberGame.astro. Tasten, Knöpfe und Takt erzeugen neue Zustände; danach zeigt der Bildschirm Zähler, Schild
// und Knöpfe nach dem Sieg und zeichnet das Feld. Nebenwirkungen eines Zustandswechsels macht nur diese Datei:
// Bestwert und „mit Lösung gesehen“ speichern, Konfetti werfen (nicht bei weniger Bewegung, nie nach vorgespielter
// Lösung) und wieder wegnehmen.
import { type Level, DIRS, parseLevel } from '../../lib/games/sokoban/level';
import { markOpened, markShown, markSkipped, recordWin } from '../../lib/games/sokoban/progress';
import { type Particle, confetti, decoFor, gameWorld, stepParticles } from '../../lib/games/sokoban/scene';
import { type Game, again, busy, key, msgKind, newGame, restart, tick, undo } from '../../lib/games/sokoban/state';
import { CONFETTI, KAJE_DECO } from '../../data/games/kaje';
import { LESSONS, type Lesson } from '../../data/games/lessons';
import { countText, fieldLabel, lessonName, nextText, signText } from '../../data/games/texts';
import { type KeyAction, keepsKey, keyAction } from './ks-input';
import { nextHash } from './ks-router';
import type { Host } from './ks-screens';
import { renderWorld } from './render/world';

/** Unter dieser Breite (CSS-px) fällt der Wasserrand weg */
const NO_RING_BELOW = 560;

function need<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Kistenschieber: ${sel} fehlt`);
  return el;
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  private lesson: Lesson = LESSONS[0]!;
  private L: Level = parseLevel(this.lesson.xsb);
  private g: Game = newGame(this.L);
  private fx: Particle[] = [];
  private deco = decoFor(this.L, KAJE_DECO);

  constructor(
    root: HTMLElement,
    private readonly host: Host,
    /** neu zeichnen lassen (im nächsten Bild, mit Test-Uhr sofort) */
    private readonly request: () => void,
    signal: AbortSignal,
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
    const on = (sel: string, fn: () => void) => need(root, sel).addEventListener('click', fn, { signal });
    on('[data-ks="undo"]', () => this.apply(undo(this.g)));
    on('[data-ks="again"]', () => this.apply(again(this.g)));
    on('[data-ks="offer"]', () => this.skip());
  }

  /** Lektion n (frei) öffnen: neues Spiel, als letzte gemerkt, Texte der Lektion */
  enter(n: number) {
    this.lesson = LESSONS[n - 1] ?? LESSONS[0]!;
    this.L = parseLevel(this.lesson.xsb);
    this.deco = decoFor(this.L, KAJE_DECO);
    this.g = newGame(this.L, { sol: this.lesson.sol, reduce: reduced() });
    this.fx = [];
    markOpened(this.host.kv, n);
    const name = lessonName(this.lesson);
    this.title.textContent = name;
    this.canvas.setAttribute('aria-label', fieldLabel(this.lesson));
    this.next.href = nextHash(n, LESSONS.length);
    this.next.textContent = nextText(n);
    this.gin.classList.toggle('left', this.host.settings().hand === 'links');
    this.sync();
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
    const now = performance.now();
    if (a.kind === 'step') this.apply(key(this.g, DIRS[a.d], now));
    else if (a.kind === 'undo') this.apply(undo(this.g));
    else if (a.kind === 'restart') this.apply(restart(this.g));
    else if (a.kind === 'next') location.hash = nextHash(this.lesson.n, LESSONS.length);
    // Tipp, Menü und Esc kommen mit dem Menü (Schritt 7); bis dahin tun sie nichts
  }

  /** „Zu knifflig? Überspringen“: merken (nur ohne Bestwert) und weiter */
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
    if (g.solutionShown && !prev.solutionShown) markShown(kv, this.lesson.n);
    if (g.won && !prev.won) {
      recordWin(kv, this.lesson.n, { moves: g.moves, pushes: g.pushes, shown: g.shownWin });
      if (g.confetti && !g.reduce) this.fx = confetti(this.L, g.boxes, now, Math.random, CONFETTI);
    }
    if (!g.confetti) this.fx = [];
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
    if (this.fx.length) this.fx = stepParticles(this.fx, now);
    this.draw(now);
    return busy(this.g) || this.fx.length > 0;
  }

  private draw(now: number) {
    const f = this.field;
    renderWorld(this.canvas, gameWorld(this.g, now, { deco: this.deco, fx: this.fx }), this.host.camera(), {
      maxS: 1.6,
      maxH: Math.max(140, f.clientHeight - 6),
      noRing: f.clientWidth < NO_RING_BELOW,
      pad: 4,
    });
  }
}
