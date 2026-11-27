// Modelle aus Quadern (Figur, Schmuck) wie im Entwurf. Rein: liefert Quader in Weltkoordinaten samt Tiefe und
// die drei sichtbaren Flächen als Vielecke; gezeichnet wird im Browser.
import { type Camera, type Point, type View, depthKey } from './camera';
import { shade } from './geometry';
import type { Facing } from '../sokoban/level';

/** Dünnes Detail: nur zeichnen, wenn diese Fläche zur Kamera zeigt (vorn, Seite plus, Seite minus) */
export type Face = 'f' | 's+' | 's-';

/** Teil: [vorn, seitlich, unten, Länge, Breite, Höhe, Farbe, Deckelfarbe?, Fläche?] in Figur-Einheiten */
export type Part = readonly [
  f: number,
  s: number,
  z: number,
  len: number,
  wid: number,
  h: number,
  col: string,
  top?: string | null,
  face?: Face,
];

export type Pose = 'stand' | 'walk' | 'push';

/** Blickrichtung → Schritt nach vorn und zur Seite in (i, j) */
export const FWD: Readonly<Record<Facing, readonly [number, number]>> = {
  i: [1, 0],
  '-i': [-1, 0],
  j: [0, 1],
  '-j': [0, -1],
};
export const SIDE: Readonly<Record<Facing, readonly [number, number]>> = {
  i: [0, 1],
  '-i': [0, -1],
  j: [-1, 0],
  '-j': [1, 0],
};

/** Teil zur anderen Seite spiegeln */
export function mir(p: Part): Part {
  const q: Part[number][] = [...p];
  q[1] = -(p[1] + p[4]);
  if (p[8] === 's+') q[8] = 's-';
  else if (p[8] === 's-') q[8] = 's+';
  return q as unknown as Part;
}

export const pair = (p: Part): Part[] => [p, mir(p)];

/** Zwei Augen vorn, je eins an den Seiten */
export function eyes(
  hf: number,
  hw: number,
  z: number,
  ew: number,
  eh: number,
  inset: number,
  col = '#1d2233',
): Part[] {
  return [
    [hf - 0.02, inset, z, 0.03, ew, eh, col, null, 'f'],
    [hf - 0.02, -inset - ew, z, 0.03, ew, eh, col, null, 'f'],
    [hf - 0.06 - ew, hw - 0.02, z, ew, 0.03, eh, col, null, 's+'],
    [hf - 0.06 - ew, -hw - 0.01, z, ew, 0.03, eh, col, null, 's-'],
  ];
}

/** Aussehen einer Figur: Farben und Zusatzteile (l = Vorlehnen beim Schieben) */
export interface Look {
  readonly skin: string;
  readonly skinD: string;
  readonly hand: string;
  readonly shoe: string;
  readonly shoeH?: number;
  readonly legs: string;
  readonly hips: string;
  readonly torso: string;
  readonly sleeve: string;
  readonly eye?: string;
  readonly eyeW?: number;
  readonly eyeH?: number;
  extra(l: number): Part[];
}

/** Figur, etwa 1,05 hoch, Kopf ein Viertel; pose stand | walk | push, a = Schwung −1…1 */
export function humanoid(o: Look, pose: Pose, a: number): Part[] {
  const l = pose === 'push' ? 0.04 : 0;
  const legR = pose === 'walk' ? 0.07 * a : 0;
  const armR = pose === 'walk' ? -0.06 * a : 0;
  const sh = o.shoeH || 0.07;
  const P: Part[] = [];
  P.push([-0.07 + legR, 0.035, 0, 0.17, 0.125, sh, o.shoe], mir([-0.07 - legR, 0.035, 0, 0.17, 0.125, sh, o.shoe]));
  P.push(
    [-0.06 + legR, 0.04, sh, 0.12, 0.115, 0.34 - sh, o.legs],
    mir([-0.06 - legR, 0.04, sh, 0.12, 0.115, 0.34 - sh, o.legs]),
  );
  P.push([-0.085, -0.16, 0.32, 0.17, 0.32, 0.1, o.hips]);
  P.push([-0.08 + l, -0.155, 0.42, 0.16, 0.31, 0.24, o.torso]);
  if (pose === 'push') {
    P.push(
      ...pair([0.0 + l, 0.155, 0.5, 0.2, 0.085, 0.1, o.sleeve]),
      ...pair([0.2 + l, 0.16, 0.495, 0.07, 0.075, 0.1, o.hand]),
    );
  } else {
    P.push(
      [-0.06 + armR, 0.155, 0.46, 0.12, 0.085, 0.2, o.sleeve],
      mir([-0.06 - armR, 0.155, 0.46, 0.12, 0.085, 0.2, o.sleeve]),
    );
    P.push(
      [-0.05 + armR, 0.16, 0.37, 0.1, 0.075, 0.09, o.hand],
      mir([-0.05 - armR, 0.16, 0.37, 0.1, 0.075, 0.09, o.hand]),
    );
  }
  P.push([-0.05 + l, -0.06, 0.66, 0.1, 0.12, 0.03, o.skin]);
  P.push([-0.15 + l, -0.15, 0.69, 0.3, 0.3, 0.28, o.skin]);
  P.push(...eyes(0.15 + l, 0.15, 0.83, o.eyeW || 0.045, o.eyeH || 0.05, 0.045, o.eye));
  P.push(...pair([0.16 + l, 0.065, 0.86, 0.006, 0.016, 0.016, '#ffffff', null, 'f']));
  P.push([0.15 + l, -0.02, 0.77, 0.03, 0.04, 0.05, o.skinD, null, 'f']);
  P.push(...pair([-0.035 + l, 0.15, 0.79, 0.05, 0.02, 0.07, o.skinD, null, 's+']));
  P.push(...o.extra(l));
  return P;
}

/** Quader in Weltkoordinaten samt Tiefe */
export interface Cuboid {
  readonly i0: number;
  readonly j0: number;
  readonly z0: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly col: string;
  readonly top: string | null;
  /** Tiefe: größer = weiter vorn */
  readonly k: number;
}

/** In der schrägen Ansicht zeigen die Flächen mit Normale +i und +j zur Kamera */
const seen = ([ni, nj]: readonly [number, number]) => (ni === 1 && nj === 0) || (ni === 0 && nj === 1);

/**
 * Teile eines Modells, gedreht in Blickrichtung dir, um (ci, cj) in Höhe z, Maßstab sc. Dünne Details, deren Fläche
 * nicht zur Kamera zeigt, fallen weg; die übrigen liegen in der Tiefe knapp (0,002) vor ihrem Grundkörper.
 */
export function modelCuboids(
  cam: Camera,
  parts: readonly Part[],
  ci: number,
  cj: number,
  z: number,
  dir: Facing,
  sc = 1,
): Cuboid[] {
  const [fi, fj] = FWD[dir];
  const [si, sj] = SIDE[dir];
  const out: Cuboid[] = [];
  for (const [f0, s0, z0, fl, sw, h0, col, top, nrm] of parts) {
    if (nrm) {
      const n: readonly [number, number] = nrm === 'f' ? [fi, fj] : nrm === 's+' ? [si, sj] : [-si, -sj];
      if (!seen(n)) continue;
    }
    const f = f0 * sc;
    const s = s0 * sc;
    const L = fl * sc;
    const Wd = sw * sc;
    const H = h0 * sc;
    const ai = ci + fi * f + si * s;
    const aj = cj + fj * f + sj * s;
    const bi = ci + fi * (f + L) + si * (s + Wd);
    const bj = cj + fj * (f + L) + sj * (s + Wd);
    const i0 = Math.min(ai, bi);
    const j0 = Math.min(aj, bj);
    const w = Math.abs(bi - ai);
    const d = Math.abs(bj - aj);
    const zz = z + z0 * sc;
    const k = depthKey(cam, i0 + w / 2, j0 + d / 2, zz + H / 2) + (nrm ? 0.002 : 0);
    out.push({ i0, j0, z0: zz, w, d, h: H, col, top: top ?? null, k });
  }
  return out;
}

/** Eine Fläche zum Füllen */
export interface FacePoly {
  readonly pts: Point[];
  readonly fill: string;
}

/** Die drei sichtbaren Flächen eines Quaders: vorn (+j) etwas dunkler, rechts (+i) dunkler, oben etwas heller */
export function cuboidFaces(
  V: View,
  c: Pick<Cuboid, 'i0' | 'j0' | 'z0' | 'w' | 'd' | 'h' | 'col' | 'top'>,
): FacePoly[] {
  const i1 = c.i0 + c.w;
  const j1 = c.j0 + c.d;
  const z1 = c.z0 + c.h;
  const { i0, j0, z0 } = c;
  return [
    { pts: [V.Q(i0, j1, z1), V.Q(i1, j1, z1), V.Q(i1, j1, z0), V.Q(i0, j1, z0)], fill: shade(c.col, -0.1) },
    { pts: [V.Q(i1, j0, z1), V.Q(i1, j1, z1), V.Q(i1, j1, z0), V.Q(i1, j0, z0)], fill: shade(c.col, -0.28) },
    { pts: [V.Q(i0, j0, z1), V.Q(i1, j0, z1), V.Q(i1, j1, z1), V.Q(i0, j1, z1)], fill: shade(c.top || c.col, 0.05) },
  ];
}
