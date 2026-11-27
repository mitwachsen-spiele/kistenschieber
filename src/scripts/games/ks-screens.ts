// Startbildschirm, Levelwahl, gesperrte Lektion und Einstellungen: füllen das statische HTML aus
// KistenschieberGame.astro mit dem Stand des Geräts (Fortschritt, Blickwinkel, Hand) und zeichnen die Szenen.
import type { Camera } from '../../lib/games/oblique/camera';
import { type Level, parseLevel } from '../../lib/games/sokoban/level';
import {
  type ProgressKV,
  allSettled,
  cardState,
  doneCount,
  firstPlayable,
  introDone,
  lastRef,
  started,
} from '../../lib/games/sokoban/progress';
import { decoFor, staticLevelWorld } from '../../lib/games/sokoban/scene';
import { KAJE_DECO } from '../../data/games/kaje';
import { LESSONS } from '../../data/games/lessons';
import {
  badgeText,
  continueText,
  introPill,
  lessonName,
  lockedGo,
  lockedWhy,
  sceneLabel,
  startStatus,
} from '../../data/games/texts';
import { SETTINGS_DEFAULT, type Hand, type Settings } from './ks-save';
import { lessonHash } from './ks-router';
import { type RenderOptions, renderWorld } from './render/world';

export const COUNT = LESSONS.length;
/** Unter dieser Breite (CSS-px) fällt der Wasserrand weg */
const NO_RING_BELOW = 560;

/** Was die Bildschirme von der Komponente brauchen */
export interface Host {
  readonly kv: ProgressKV;
  settings(): Settings;
  /** Einstellung merken und anwenden (Kamera) */
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  camera(): Camera;
}

const levels = new Map<number, Level>();
function levelOf(n: number): Level {
  let L = levels.get(n);
  if (!L) {
    L = parseLevel(LESSONS[n - 1]?.xsb ?? LESSONS[0]!.xsb);
    levels.set(n, L);
  }
  return L;
}

/** Ruhebild einer Lektion samt Schmuck; ohne Wasserrand, wenn die Szene schmal ist */
export function drawLesson(cv: HTMLCanvasElement, n: number, cam: Camera, opt: RenderOptions) {
  const L = levelOf(n);
  const noRing = opt.noRing ?? (cv.parentElement?.clientWidth ?? 0) < NO_RING_BELOW;
  renderWorld(cv, staticLevelWorld(L, decoFor(L, KAJE_DECO)), cam, { ...opt, noRing });
}

function need<T extends Element>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Kistenschieber: ${sel} fehlt`);
  return el;
}

/** Start: Titel, wie weit die Einführung ist, Szene der Lektion, bei der es weitergeht, und der große Knopf */
export class StartScreen {
  private readonly canvas: HTMLCanvasElement;
  private readonly status: HTMLElement;
  private readonly go: HTMLAnchorElement;
  private n = 1;

  constructor(
    root: HTMLElement,
    private readonly host: Host,
  ) {
    this.canvas = need(root, 'canvas');
    this.status = need(root, '[data-ks="status"]');
    this.go = need(root, '[data-ks="continue"]');
  }

  enter() {
    const { kv } = this.host;
    this.n = lastRef(kv, COUNT);
    const lesson = LESSONS[this.n - 1];
    this.status.textContent = startStatus(doneCount(kv, COUNT), COUNT, introDone(kv, COUNT));
    this.go.textContent = continueText(started(kv, COUNT), this.n);
    this.go.href = lessonHash(this.n);
    if (lesson) this.canvas.setAttribute('aria-label', sceneLabel(lesson));
  }

  draw() {
    drawLesson(this.canvas, this.n, this.host.camera(), { maxS: 1.1, maxH: Math.max(220, innerHeight * 0.4) });
  }
}

/** Levelwahl: Zustand je Karte (gesperrt, ✓, ↷, gesehen), die goldene Karte „dran“, die Vorschaubilder */
export class LevelScreen {
  private readonly cards: {
    readonly a: HTMLAnchorElement;
    readonly cv: HTMLCanvasElement;
    readonly badge: HTMLElement;
  }[];
  private readonly pill: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly host: Host,
  ) {
    this.pill = need(root, '[data-ks="intro-pill"]');
    this.cards = LESSONS.map((l) => {
      const a = need<HTMLAnchorElement>(root, `#${l.id}`);
      return { a, cv: need<HTMLCanvasElement>(a, 'canvas'), badge: need<HTMLElement>(a, '.badge') };
    });
  }

  enter() {
    const { kv } = this.host;
    const cur = lastRef(kv, COUNT);
    this.cards.forEach(({ a, badge }, i) => {
      const n = i + 1;
      const state = cardState(kv, n);
      a.className = `card lv ${state}${n === cur ? ' cur' : ''}`;
      const text = badgeText(state, kv.best(n));
      badge.textContent = text ?? '';
      badge.hidden = text === null;
    });
    const done = allSettled(kv, COUNT);
    this.pill.textContent = introPill(COUNT, done);
    this.pill.classList.toggle('on', done);
  }

  draw() {
    const cam = this.host.camera();
    this.cards.forEach(({ cv }, i) => drawLesson(cv, i + 1, cam, { maxS: 0.62, pad: 4, noRing: true }));
  }
}

/** Eine Lektion, die noch zu ist: warum, und der Weg zur ersten offenen */
export class LockedScreen {
  private readonly which: HTMLElement;
  private readonly why: HTMLElement;
  private readonly go: HTMLAnchorElement;

  constructor(
    root: HTMLElement,
    private readonly host: Host,
  ) {
    this.which = need(root, '[data-ks="which"]');
    this.why = need(root, '[data-ks="why"]');
    this.go = need(root, '[data-ks="first"]');
  }

  /** n: die gesperrte Lektion aus dem Hash; ihr Name steht über der Überschrift wie im Entwurf */
  enter(n: number | null) {
    const locked = n === null ? undefined : LESSONS[n - 1];
    this.which.textContent = locked ? lessonName(locked) : '';
    const k = firstPlayable(this.host.kv, COUNT);
    const lesson = LESSONS[k - 1];
    if (lesson) this.why.textContent = lockedWhy(lesson);
    this.go.textContent = lockedGo(k);
    this.go.href = lessonHash(k);
  }
}

/** Einstellungen: Drehung und Neigung mit Vorschau, Zurücksetzen, Seite des Steuerkreuzes */
export class SettingsScreen {
  private readonly preview: HTMLCanvasElement;
  private readonly back: HTMLAnchorElement;
  private readonly yaw: HTMLInputElement;
  private readonly tilt: HTMLInputElement;
  private readonly hands: HTMLButtonElement[];
  private n = 1;

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
    // Schon installiert: Die Anleitung zum Installieren braucht es nicht mehr
    const standalone =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    need<HTMLElement>(root, '[data-ks="install"]').hidden = standalone;
  }

  /** Regler, Anzeigen und Handwahl auf den gespeicherten Stand */
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
  }

  enter() {
    this.n = lastRef(this.host.kv, COUNT);
    this.back.href = lessonHash(this.n);
    this.sync();
  }

  draw() {
    drawLesson(this.preview, this.n, this.host.camera(), { maxS: 0.9, maxH: 300 });
  }
}
