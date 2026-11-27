// Szene aus dem Spielzustand: was der Renderer zeichnet (Boden, Ziele, Kisten samt Markierung, Figur, Pfeile, Schmuck,
// Konfetti). Rein: Zeit und Zufall kommen als Parameter, Farben und Modelle des Stils vom Aufrufer.
import type { Area } from '../oblique/camera';
import { FWD, type Part, type Pose } from '../oblique/models';
import { type CellType, type Dir, type Facing, type Level, cellType, nb } from './level';
import { type Game, dirKey, options } from './state';

export type Mark = 'sel' | 'hint' | 'stuck';
export type ArrowKind = 'hint' | 'sel' | 'dead';

export interface WorldCrate {
  readonly id: number;
  /** linke obere Ecke der Zelle (Spalte, Zeile), beim Schieben dazwischen */
  readonly x: number;
  readonly y: number;
  /** steht auf einem Ziel (erst nach dem Schieben) */
  readonly ok: boolean;
  readonly mark: Mark | null;
}

export interface WorldFig {
  /** Mitte der Figur */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly dir: Facing;
  readonly pose: Pose;
  /** Schwung −1…1 */
  readonly a: number;
}

export interface WorldArrow {
  readonly r: number;
  readonly c: number;
  readonly d: Dir;
  readonly kind: ArrowKind;
}

export interface Deco {
  readonly parts: readonly Part[];
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly dir: Facing;
  readonly sc: number;
}

export interface Particle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly col: string;
  readonly t0: number;
}

export interface World extends Area {
  readonly type: (r: number, c: number) => CellType;
  readonly goals: readonly { readonly r: number; readonly c: number }[];
  readonly crates: readonly WorldCrate[];
  readonly figs: readonly WorldFig[];
  readonly arrows: readonly WorldArrow[];
  readonly deco: readonly Deco[];
  readonly fx: readonly Particle[];
}

/** Beim Schieben steht die Figur so weit vor ihrer Zelle */
export const PUSH_OFFSET = 0.22;
/** Ruck gegen eine Wand oder eine blockierte Kiste */
export const BUMP_JERK = 0.1;
export const CONFETTI_PER_BOX = 18;
export const CONFETTI_LIFE = 1400;
export const GRAVITY = 6;

const xy = (L: Pick<Level, 'W'>, k: number): [c: number, r: number] => [k % L.W, Math.floor(k / L.W)];

function base(L: Level) {
  return {
    r0: 0,
    r1: L.H - 1,
    c0: 0,
    c1: L.W - 1,
    type: cellType(L),
    goals: [...L.goals].map((k) => {
      const [c, r] = xy(L, k);
      return { r, c };
    }),
  };
}

/** Schmuck für ein Feld */
export interface DecoLook {
  readonly bollard: readonly Part[];
  readonly gull: readonly Part[];
  /** Höhe der Mauer, auf der der Schmuck steht */
  readonly wallHeight: number;
}

/**
 * Poller auf den Ecken und Mitten oben und unten, wo dort Mauer ist; auf dem zweiten Platz (oben rechts) sitzt
 * zusätzlich die Möwe, Blick nach links, etwas größer
 */
export function decoFor(L: Level, look: DecoLook): Deco[] {
  const out: Deco[] = [];
  const spots: [number, number][] = [
    [0, 0],
    [0, L.W - 1],
    [L.H - 1, 0],
    [L.H - 1, L.W - 1],
    [0, L.W >> 1],
    [L.H - 1, L.W >> 1],
  ];
  spots.forEach(([r, c], n) => {
    if (!L.walls.has(r * L.W + c)) return;
    out.push({ parts: look.bollard, x: c + 0.5, y: r + 0.5, z: look.wallHeight, dir: 'j', sc: 1 });
    if (n === 1) out.push({ parts: look.gull, x: c + 0.5, y: r + 0.5, z: look.wallHeight + 0.27, dir: '-i', sc: 1.2 });
  });
  return out;
}

/** Ruhebild eines Feldes (Start, Einstellungen, Levelkarten): Startstellung, Figur steht und schaut zur Kamera */
export function staticLevelWorld(L: Level, deco: readonly Deco[] = []): World {
  const [pc, pr] = xy(L, L.player);
  return {
    ...base(L),
    crates: L.boxes.map((k, id) => {
      const [c, r] = xy(L, k);
      return { id, x: c, y: r, ok: L.goals.has(k), mark: null };
    }),
    figs: [{ x: pc + 0.5, y: pr + 0.5, z: 0, dir: 'j', pose: 'stand', a: 0 }],
    arrows: [],
    deco,
    fx: [],
  };
}

/** Fortschritt der laufenden Animation 0…1 (ohne Animation 1) */
export const animT = (g: Pick<Game, 'a'>, now: number): number => (g.a ? Math.min(1, (now - g.a.t0) / g.a.dur) : 1);

function figure(g: Game, now: number): WorldFig {
  const A = g.a;
  const t = animT(g, now);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  let [pc, pr] = xy(g.L, g.p);
  let pose: Pose = 'stand';
  let a = 0;
  const [fi, fj] = FWD[g.dir];
  if (A && (A.kind === 'walk' || A.kind === 'push')) {
    const [fc, fr] = xy(g.L, A.from);
    const [tc, tr] = xy(g.L, A.to);
    pc = lerp(fc, tc);
    pr = lerp(fr, tr);
    pose = A.kind;
    a = Math.sin(t * Math.PI) * (A.n % 2 ? 1 : -1);
  } else if (A) {
    const k = Math.sin(t * Math.PI) * BUMP_JERK;
    pc += fi * k;
    pr += fj * k;
  }
  if (pose === 'push' || A?.kind === 'blocked') {
    pc += fi * PUSH_OFFSET;
    pr += fj * PUSH_OFFSET;
    pose = 'push';
  }
  return { x: pc + 0.5, y: pr + 0.5, z: 0, dir: g.dir, pose, a };
}

function crates(g: Game, now: number): WorldCrate[] {
  const A = g.a;
  const t = animT(g, now);
  return g.boxes.map((k, id) => {
    let [c, r] = xy(g.L, k);
    let moving = false;
    if (A?.kind === 'push' && A.box === id) {
      const [fc, fr] = xy(g.L, A.bfrom);
      const [tc, tr] = xy(g.L, A.bto);
      c = fc + (tc - fc) * t;
      r = fr + (tr - fr) * t;
      moving = t < 1;
    }
    const mark: Mark | null = g.stuck.includes(id)
      ? 'stuck'
      : g.sel === id
        ? 'sel'
        : g.hint?.box === id
          ? 'hint'
          : null;
    return { id, x: c, y: r, ok: !moving && g.L.goals.has(k), mark };
  });
}

/**
 * Pfeile nur bei ausgewählter Kiste, ohne Animation und vor dem Sieg: je mögliche Richtung auf dem Feld, in das die
 * Kiste käme. Tipp-Richtung (verglichen über den Namen) türkis, Sackgasse grau, sonst gold.
 */
function arrows(g: Game): WorldArrow[] {
  if (g.sel === null || g.a || g.won) return [];
  const k = g.boxes[g.sel];
  if (k === undefined) return [];
  return options(g, g.sel).map((d) => {
    const t = nb(g.L, k, d);
    const [c, r] = xy(g.L, t);
    const kind: ArrowKind = g.hint?.d === dirKey(d) ? 'hint' : !g.L.goals.has(t) && !g.L.live.has(t) ? 'dead' : 'sel';
    return { r, c, d, kind };
  });
}

/** Szene zum Zeitpunkt now: Figur und geschobene Kiste linear zwischen Start und Ziel der Animation */
export function gameWorld(
  g: Game,
  now: number,
  extra: { readonly deco?: readonly Deco[]; readonly fx?: readonly Particle[] } = {},
): World {
  return {
    ...base(g.L),
    crates: crates(g, now),
    figs: [figure(g, now)],
    arrows: arrows(g),
    deco: extra.deco ?? [],
    fx: extra.fx ?? [],
  };
}

/**
 * Konfetti beim Sieg: je Kiste 18 Teilchen ab der Kistenmitte in Höhe 0,9, Richtung und Tempo zufällig, Farben
 * reihum. Der Aufrufer lässt es bei weniger Bewegung und nach vorgespielter Lösung weg.
 */
export function confetti(
  L: Pick<Level, 'W'>,
  boxes: readonly number[],
  now: number,
  random: () => number,
  colours: readonly string[],
): Particle[] {
  const out: Particle[] = [];
  for (const b of boxes) {
    const [c, r] = xy(L, b);
    for (let k = 0; k < CONFETTI_PER_BOX; k++) {
      const ang = random() * Math.PI * 2;
      const sp = 0.6 + random() * 0.8;
      const vz = 2.2 + random() * 1.4;
      const col = colours[k % colours.length] ?? '#ffffff';
      out.push({ x: c + 0.5, y: r + 0.5, z: 0.9, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vz, col, t0: now });
    }
  }
  return out;
}

/** Ein Takt (dt in s, fest 1/60 wie im Entwurf): fliegen, fallen; weg nach 1400 ms oder unter z −0,1 */
export function stepParticles(ps: readonly Particle[], now: number, dt = 1 / 60): Particle[] {
  return ps
    .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, z: p.z + p.vz * dt, vz: p.vz - GRAVITY * dt }))
    .filter((p) => now - p.t0 < CONFETTI_LIFE && p.z > -0.1);
}
