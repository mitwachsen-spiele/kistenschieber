// Startbildschirm, Levelwahl, gesperrte Lektion (gesperrtes Level) und Einstellungen: füllen das statische HTML aus
// KistenschieberGame.astro mit dem Stand des Geräts (Fortschritt, Kalender, Blickwinkel, Hand) und zeichnen die Szenen.
import type { Camera } from '../../lib/games/oblique/camera';
import { type Level, parseLevel } from '../../lib/games/sokoban/level';
import {
  type ProgressKV,
  cardState,
  dayCome,
  doneCount,
  firstPlayable,
  introComplete,
  lastRef,
  nextOpen,
  skippedCount,
  startPoint,
  started,
} from '../../lib/games/sokoban/progress';
import { decoFor, staticLevelWorld } from '../../lib/games/sokoban/scene';
import { KAJE_DECO } from '../../data/games/kaje';
import { LESSONS } from '../../data/games/lessons';
import { LEVELS, openCount } from '../../data/games/levels';
import { COUNTS, type Pack, PUZZLES } from '../../data/games/packs';
import {
  LEVEL_PART,
  LOCKED,
  LOCKED_LEVEL,
  badgeText,
  continueText,
  introPill,
  levelGo,
  levelStatus,
  lockedDay,
  lockedGo,
  lockedWhy,
  puzzleName,
  sceneLabel,
  startPill,
  startStatus,
} from '../../data/games/texts';
import { SETTINGS_DEFAULT, type Hand, type Settings, type Ton } from './ks-save';
import { lessonHash, puzzleHash } from './ks-router';
import { type RenderOptions, renderWorld } from './render/world';

export const COUNT = LESSONS.length;
/** Unter dieser Breite (CSS-px) fällt der Wasserrand weg */
const NO_RING_BELOW = 560;

/** Wo „Zurück zum Spiel“ hinführt: Paket und Nummer */
export interface Resume {
  readonly pack: Pack;
  readonly n: number;
}

/** Was die Bildschirme von der Komponente brauchen */
export interface Host {
  /** Fortschritt der Einführung (e) und der Level (l, mit Kalender) */
  readonly kv: Readonly<Record<Pack, ProgressKV>>;
  /** Jetzt (ms seit 1970), für den Adventskalender; Browser-Tests stellen die Uhr */
  now(): number;
  /** Zuletzt gespielt (Lektion oder Level): Ziel von „Zurück zum Spiel“ */
  resume(): Resume;
  settings(): Settings;
  /** Einstellung merken und anwenden (Kamera) */
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  camera(): Camera;
}

const parsed = new Map<string, Level>();
function levelOf(pack: Pack, n: number): Level {
  const key = `${pack}${n}`;
  let L = parsed.get(key);
  if (!L) {
    L = parseLevel(PUZZLES[pack][n - 1]?.xsb ?? LESSONS[0]!.xsb);
    parsed.set(key, L);
  }
  return L;
}

/** Ruhebild einer Lektion oder eines Levels samt Schmuck; ohne Wasserrand, wenn die Szene schmal ist */
export function drawPuzzle(cv: HTMLCanvasElement, pack: Pack, n: number, cam: Camera, opt: RenderOptions) {
  const L = levelOf(pack, n);
  const noRing = opt.noRing ?? (cv.parentElement?.clientWidth ?? 0) < NO_RING_BELOW;
  renderWorld(cv, staticLevelWorld(L, decoFor(L, KAJE_DECO)), cam, { ...opt, noRing });
}

/** Das erste Level, dessen Tag noch nicht gekommen ist, mit seinem Tag; null, wenn alle aufgegangen sind */
function nextDay(now: number): { readonly n: number; readonly opens: string } | null {
  const level = LEVELS[openCount(now)];
  return level ? { n: level.n, opens: level.opens } : null;
}

function need<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Kistenschieber: ${sel} fehlt`);
  return el;
}

/**
 * Start: Titel, Szene der Lektion, bei der es weitergeht, und zwei Teile: die Einführung mit Fortschritt, Haken und
 * großem Knopf, daneben die Level als Adventskalender: vor dem ersten Tag nur, wann es losgeht; danach Fortschritt, wann
 * das nächste aufgeht, und ein Knopf zum ersten offenen Level. Gold trägt genau ein Knopf: der der Einführung, bis sie
 * geschafft ist, danach der der Level
 */
export class StartScreen {
  private readonly canvas: HTMLCanvasElement;
  private readonly intro: HTMLElement;
  private readonly pill: HTMLElement;
  private readonly status: HTMLElement;
  private readonly go: HTMLAnchorElement;
  private readonly levels: HTMLElement;
  private readonly levelPill: HTMLElement;
  private readonly levelStatus: HTMLElement;
  private readonly levelGo: HTMLAnchorElement;
  private readonly parts: HTMLElement;
  private n = 1;

  constructor(
    root: HTMLElement,
    private readonly host: Host,
  ) {
    this.canvas = need(root, 'canvas');
    this.intro = need(root, '[data-ks="intro"]');
    this.pill = need(root, '[data-ks="intro-state"]');
    this.status = need(root, '[data-ks="status"]');
    this.go = need(root, '[data-ks="continue"]');
    this.levels = need(root, '[data-ks="levels"]');
    this.levelPill = need(root, '[data-ks="level-state"]');
    this.levelStatus = need(root, '[data-ks="level-status"]');
    this.levelGo = need(root, '[data-ks="level-go"]');
    this.parts = need(root, '.parts');
  }

  enter() {
    const kv = this.host.kv.e;
    const complete = introComplete(kv, COUNT);
    // Geschafft: von vorn, außer eine Wiederholung läuft; sonst nichts mehr offen: zum Nachholen (progress.ts)
    const { n, repeat } = startPoint(kv, COUNT);
    this.n = n;
    const lesson = LESSONS[n - 1];
    this.intro.classList.toggle('done', complete);
    this.pill.textContent = startPill(complete);
    this.pill.classList.toggle('on', complete);
    this.status.textContent = startStatus(doneCount(kv, COUNT), COUNT, complete, skippedCount(kv, COUNT));
    this.go.textContent = continueText(started(kv, COUNT), n, repeat);
    this.go.href = lessonHash(this.n);
    if (lesson) this.canvas.setAttribute('aria-label', sceneLabel(lesson));
    const level = this.enterLevels();
    // Genau ein goldener Knopf: die Level erst, wenn die Einführung geschafft ist und ein Level offen ist
    const levelsFirst = complete && level > 0;
    this.go.classList.toggle('primary', !levelsFirst);
    this.levelGo.classList.toggle('primary', levelsFirst);
  }

  /** Teil „Level“; liefert das Level, zu dem der Knopf führt (0: keins, der Knopf ist verborgen) */
  private enterLevels(): number {
    const kv = this.host.kv.l;
    const now = this.host.now();
    const open = openCount(now);
    const first = LEVELS[0];
    const last = LEVELS.at(-1);
    // Vor dem ersten Tag gedämpft wie eine Ankündigung, danach eine Karte wie die Einführung
    this.levels.classList.toggle('soon', open === 0);
    this.levels.classList.toggle('now', open > 0);
    // Beide Teile spielbar: auf niedrigen Bildschirmen ohne Unterzeilen und mit kleinerer Szene (game.css, draw)
    this.parts.classList.toggle('both', open > 0);
    this.levelPill.textContent = open === 0 ? LEVEL_PART.soon : LEVEL_PART.now;
    this.levelPill.classList.toggle('now', open > 0);
    if (first && last)
      this.levelStatus.textContent = levelStatus(
        doneCount(kv, COUNTS.l),
        open,
        { first: first.opens, last: last.opens },
        nextDay(now),
      );
    // Weiter beim zuletzt geöffneten Level, sonst beim ersten offenen; ist keins mehr offen, kein Knopf
    const k = nextOpen(kv, COUNTS.l) && lastRef(kv, COUNTS.l);
    this.levelGo.hidden = k === 0;
    if (k) {
      this.levelGo.textContent = levelGo(started(kv, COUNTS.l), k);
      this.levelGo.href = puzzleHash('l', k);
    }
    return k;
  }

  /**
   * Höhe der Szene: 30 % des Bildschirms, mit beiden Teilen spielbar 24 % (Platz für den Knopf der Level), auf großen
   * hochkant (Tablet) 45 %, damit kein Himmel leer bleibt
   */
  draw() {
    const both = this.parts.classList.contains('both');
    const share = innerWidth >= 700 && innerHeight > innerWidth ? 0.45 : both ? 0.24 : 0.3;
    drawPuzzle(this.canvas, 'e', this.n, this.host.camera(), { maxS: 1.1, maxH: Math.max(200, innerHeight * share) });
  }
}

/** Eine Karte der Levelwahl: Lektion oder Level */
interface Card {
  readonly pack: Pack;
  readonly n: number;
  readonly a: HTMLAnchorElement;
  readonly cv: HTMLCanvasElement;
  readonly badge: HTMLElement;
}

/**
 * Levelwahl: Zustand je Karte (gesperrt, ✓, ↷, gesehen; ein Level vor seinem Tag sagt, wann es aufgeht), je Paket die
 * goldene Karte „dran“, die Vorschaubilder
 */
export class LevelScreen {
  private readonly cards: Card[];
  private readonly pill: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly host: Host,
  ) {
    this.pill = need(root, '[data-ks="intro-pill"]');
    this.cards = (['e', 'l'] as const).flatMap((pack) =>
      PUZZLES[pack].map((p) => {
        const a = need<HTMLAnchorElement>(root, `#${p.id}`);
        return { pack, n: p.n, a, cv: need<HTMLCanvasElement>(a, 'canvas'), badge: need<HTMLElement>(a, '.badge') };
      }),
    );
  }

  enter() {
    const cur = {
      e: lastRef(this.host.kv.e, COUNTS.e),
      l: nextOpen(this.host.kv.l, COUNTS.l) && lastRef(this.host.kv.l, COUNTS.l),
    };
    for (const { pack, n, a, badge } of this.cards) {
      const kv = this.host.kv[pack];
      const state = cardState(kv, n);
      a.className = `card lv ${state}${n === cur[pack] ? ' cur' : ''}`;
      const opens = pack === 'l' && !dayCome(kv, n) ? (LEVELS[n - 1]?.opens ?? null) : null;
      const text = badgeText(state, kv.best(n), opens);
      badge.textContent = text ?? '';
      badge.hidden = text === null;
    }
    const done = introComplete(this.host.kv.e, COUNT);
    this.pill.textContent = introPill(COUNT, done);
    this.pill.classList.toggle('on', done);
  }

  draw() {
    const cam = this.host.camera();
    for (const { pack, n, cv } of this.cards) drawPuzzle(cv, pack, n, cam, { maxS: 0.62, pad: 4, noRing: true });
  }
}

/**
 * Eine Lektion oder ein Level, das noch zu ist: warum (voriges noch offen, beim Level auch: sein Tag ist noch nicht
 * gekommen) und der Weg zum ersten offenen. Ist noch kein Level aufgegangen, führt der Knopf zur Einführung
 */
export class LockedScreen {
  private readonly title: HTMLElement;
  private readonly which: HTMLElement;
  private readonly why: HTMLElement;
  private readonly go: HTMLAnchorElement;
  private readonly note: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly host: Host,
  ) {
    this.title = need(root, 'h2');
    this.which = need(root, '[data-ks="which"]');
    this.why = need(root, '[data-ks="why"]');
    this.go = need(root, '[data-ks="first"]');
    this.note = need(root, '[data-ks="note"]');
  }

  /** pack, n: die gesperrte Lektion (das Level) aus dem Hash; ihr Name steht über der Überschrift wie im Entwurf */
  enter(pack: Pack, n: number | null) {
    const kv = this.host.kv[pack];
    const locked = n === null ? undefined : PUZZLES[pack][n - 1];
    this.which.textContent = locked ? puzzleName(pack, locked) : '';
    this.title.textContent = pack === 'e' ? LOCKED.title : LOCKED_LEVEL.title;
    this.note.textContent = pack === 'e' ? LOCKED.note : LOCKED_LEVEL.note;
    const level = pack === 'l' ? LEVELS[(n ?? 1) - 1] : undefined;
    const k = firstPlayable(kv, COUNTS[pack]);
    const first = PUZZLES[pack][k - 1];
    if (level && n !== null && !dayCome(kv, n)) this.why.textContent = lockedDay(level, level.opens);
    else if (first) this.why.textContent = lockedWhy(first, pack);
    // Noch kein Level offen: zur Einführung, dort geht es weiter
    const to: Resume = dayCome(kv, k) ? { pack, n: k } : { pack: 'e', n: lastRef(this.host.kv.e, COUNT) };
    this.go.textContent = lockedGo(to.n, to.pack);
    this.go.href = puzzleHash(to.pack, to.n);
  }
}

/** Einstellungen: Drehung und Neigung mit Vorschau, Zurücksetzen, Ton an oder aus, Seite des Steuerkreuzes */
export class SettingsScreen {
  private readonly preview: HTMLCanvasElement;
  private readonly back: HTMLAnchorElement;
  private readonly yaw: HTMLInputElement;
  private readonly tilt: HTMLInputElement;
  private readonly hands: HTMLButtonElement[];
  private readonly tons: HTMLButtonElement[];
  private spot: Resume = { pack: 'e', n: 1 };

  constructor(
    root: HTMLElement,
    private readonly host: Host,
    signal: AbortSignal,
  ) {
    this.preview = need(root, 'canvas');
    this.back = need(root, '[data-ks="back"]');
    this.yaw = need(root, '#cam-yaw');
    this.tilt = need(root, '#cam-tilt');
    this.hands = [...root.querySelectorAll<HTMLButtonElement>('[data-hand]')];
    this.tons = [...root.querySelectorAll<HTMLButtonElement>('[data-ton]')];
    const slider = (inp: HTMLInputElement, key: 'drehung' | 'neigung') => {
      inp.addEventListener(
        'input',
        () => {
          this.host.set(key, Number(inp.value));
          this.sync();
          this.draw();
        },
        { signal },
      );
      // Sonst bleiben die Pfeiltasten im Regler hängen
      inp.addEventListener('change', () => inp.blur(), { signal });
    };
    slider(this.yaw, 'drehung');
    slider(this.tilt, 'neigung');
    need(root, '[data-ks="reset"]').addEventListener(
      'click',
      () => {
        this.host.set('drehung', SETTINGS_DEFAULT.drehung);
        this.host.set('neigung', SETTINGS_DEFAULT.neigung);
        this.sync();
        this.draw();
      },
      { signal },
    );
    for (const b of this.hands)
      b.addEventListener(
        'click',
        () => {
          this.host.set('hand', b.dataset.hand === 'links' ? 'links' : 'rechts');
          this.sync();
        },
        { signal },
      );
    for (const b of this.tons)
      b.addEventListener(
        'click',
        () => {
          this.host.set('ton', b.dataset.ton === 'aus' ? 'aus' : 'an');
          this.sync();
        },
        { signal },
      );
    // Schon installiert: Die Anleitung zum Installieren braucht es nicht mehr
    const standalone =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    need<HTMLElement>(root, '[data-ks="install"]').hidden = standalone;
  }

  /** Regler, Anzeigen, Ton und Handwahl auf den gespeicherten Stand */
  private sync() {
    const s = this.host.settings();
    const set = (inp: HTMLInputElement, v: number) => {
      inp.value = String(v);
      const out = inp.parentElement?.querySelector<HTMLOutputElement>(`output[for="${inp.id}"]`);
      if (out) out.value = `${v}°`;
    };
    set(this.yaw, s.drehung);
    set(this.tilt, s.neigung);
    const hand: Hand = s.hand;
    for (const b of this.hands) b.setAttribute('aria-pressed', String(b.dataset.hand === hand));
    const ton: Ton = s.ton;
    for (const b of this.tons) b.setAttribute('aria-pressed', String(b.dataset.ton === ton));
  }

  enter() {
    this.spot = this.host.resume();
    this.back.href = puzzleHash(this.spot.pack, this.spot.n);
    this.sync();
  }

  draw() {
    drawPuzzle(this.preview, this.spot.pack, this.spot.n, this.host.camera(), { maxS: 0.9, maxH: 300 });
  }
}
