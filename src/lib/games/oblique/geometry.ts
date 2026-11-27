// Flache Formen in Weltkoordinaten, Umrisse, Treffer-Test und Abschattung für die schräge Ansicht. Rein.
import type { Point, View } from './camera';
import type { Dir } from '../sokoban/level';

/** Punkt in der Ebene (i, j) */
export type Flat = readonly [i: number, j: number];

/** Quadrat mit halber Kantenlänge h um (cx, cy) */
export const square = (cx: number, cy: number, h: number): Flat[] => [
  [cx - h, cy - h],
  [cx + h, cy - h],
  [cx + h, cy + h],
  [cx - h, cy + h],
];

/** Ellipse aus 16 Punkten */
export const ellipse = (cx: number, cy: number, rx: number, ry: number): Flat[] =>
  Array.from({ length: 16 }, (_, n) => [
    cx + Math.cos((n / 16) * Math.PI * 2) * rx,
    cy + Math.sin((n / 16) * Math.PI * 2) * ry,
  ]);

/** Flache Punkte in Höhe z auf den Bildschirm */
export const flatPts = (V: View, pts: readonly Flat[], z: number): Point[] => pts.map(([i, j]) => V.Q(i, j, z));

/** Umriss eines Quaders in der schrägen Ansicht (Sechseck) */
export function hull(V: View, i0: number, j0: number, z0: number, w: number, d: number, h: number): Point[] {
  const i1 = i0 + w;
  const j1 = j0 + d;
  const z1 = z0 + h;
  return [V.Q(i0, j0, z1), V.Q(i1, j0, z1), V.Q(i1, j0, z0), V.Q(i1, j1, z0), V.Q(i0, j1, z0), V.Q(i0, j1, z1)];
}

/** Liegt (x, y) im Vieleck? (Strahl-Test) */
export function inPoly(x: number, y: number, P: readonly Point[]): boolean {
  let inside = false;
  for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
    const [xa, ya] = P[a]!;
    const [xb, yb] = P[b]!;
    if (ya > y !== yb > y && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

/** Treffer-Flächen einer gezeichneten Szene, in CSS-px relativ zur Canvas */
export type HitObj =
  | { readonly type: 'wall'; readonly r: number; readonly c: number; readonly k: number; readonly poly: Point[] }
  | { readonly type: 'crate'; readonly id: number; readonly k: number; readonly poly: Point[] }
  | { readonly type: 'fig'; readonly k: number; readonly poly: Point[] };

export interface FloorHit {
  readonly r: number;
  readonly c: number;
  readonly poly: Point[];
}

export interface Hits {
  readonly objs: readonly HitObj[];
  readonly floors: readonly FloorHit[];
}

export type Picked =
  Exclude<HitObj, { type: 'wall' }> | { readonly type: 'floor'; readonly r: number; readonly c: number };

/**
 * Was liegt unter (x, y)? Das vorderste Objekt zuerst, dann der Boden. Mauern sind nie ein Ziel: Wer auf eine
 * Mauer tippt, meint das Feld dahinter.
 */
export function pick(hits: Hits | null, x: number, y: number): Picked | null {
  if (!hits) return null;
  const objs = hits.objs.filter((o): o is Picked & HitObj => o.type !== 'wall').sort((a, b) => b.k - a.k);
  for (const o of objs) if (inPoly(x, y, o.poly)) return o;
  for (const f of hits.floors) if (inPoly(x, y, f.poly)) return { type: 'floor', r: f.r, c: f.c };
  return null;
}

const shadeCache = new Map<string, string>();

/** Farbe abdunkeln (f < 0, mal 1 + f) oder Richtung Weiß aufhellen (f > 0); Ergebnis als rgb() */
export function shade(hex: string, f: number): string {
  const key = hex + f;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (f < 0) {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  } else {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  }
  const v = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, v);
  return v;
}

/** Pfeil in lokalen Koordinaten (u nach vorn, v quer), Spitze bei u = 0,3 */
export const ARROW: readonly Flat[] = [
  [-0.26, -0.11],
  [0.04, -0.11],
  [0.04, -0.25],
  [0.3, 0],
  [0.04, 0.25],
  [0.04, 0.11],
  [-0.26, 0.11],
];

/** Pfeil auf Feld (r, c) in Richtung d, als Punkte in der Ebene */
export function arrowPoly(r: number, c: number, [dr, dc]: Dir): Flat[] {
  const cx = c + 0.5;
  const cy = r + 0.5;
  return ARROW.map(([u, v]) => [cx + u * dc - v * dr, cy + u * dr + v * dc]);
}
