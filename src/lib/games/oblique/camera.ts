// Schräge Kamera wie im Entwurf: Drehung um die Hochachse (yaw) und Neigung (Blick von oben, tilt). Rein und
// browser-sicher. Weltachsen: i = Spalte, j = Zeile, z = Höhe (Boden-Oberkante z = 0).
// Bei Neigung 30° entsprechen die Maße Mitwachsen (Draufsicht halb gestaucht, Blockhöhe 44,8).
import { DIRS, type Dir, type DirKey } from '../sokoban/level';

/** Kantenlänge einer Zelle in px bei Maßstab 1 */
export const IS = 40 * Math.SQRT2;
export const CAM_DEFAULT = { yaw: 20, tilt: 50 } as const;
/** erlaubte Drehung und Neigung in Grad */
export const YAW_RANGE = [0, 45] as const;
export const TILT_RANGE = [20, 80] as const;

export type Point = readonly [x: number, y: number];

export interface Camera {
  readonly yaw: number;
  readonly tilt: number;
  readonly CS: number;
  readonly SN: number;
  readonly KY: number;
  /** px je Höheneinheit bei Maßstab 1 */
  readonly ZS: number;
  /** Breite der Draufsicht eines Blocks */
  readonly IW: number;
  /** Höhe der Draufsicht eines Blocks */
  readonly IT: number;
  /** Schlüssel für Caches gezeichneter Blöcke */
  readonly key: string;
}

export function makeCamera(yawDeg: number, tiltDeg: number): Camera {
  const y = (yawDeg * Math.PI) / 180;
  const t = (tiltDeg * Math.PI) / 180;
  const CS = Math.cos(y);
  const SN = Math.sin(y);
  const KY = Math.sin(t);
  return {
    yaw: yawDeg,
    tilt: tiltDeg,
    CS,
    SN,
    KY,
    ZS: (44.8 * Math.cos(t)) / Math.cos(Math.PI / 6),
    IW: (CS + SN) * IS,
    IT: (CS + SN) * KY * IS,
    key: `${yawDeg}|${tiltDeg}`,
  };
}

const inRange = (v: number, [lo, hi]: readonly [number, number]) => Number.isFinite(v) && v >= lo && v <= hi;

/** Gültige Kamera-Werte; was außerhalb der Bereiche liegt, fällt auf die Voreinstellung zurück (wie im Entwurf) */
export function clampCamera(yaw: number, tilt: number): { yaw: number; tilt: number } {
  return {
    yaw: inRange(yaw, YAW_RANGE) ? yaw : CAM_DEFAULT.yaw,
    tilt: inRange(tilt, TILT_RANGE) ? tilt : CAM_DEFAULT.tilt,
  };
}

/** Bildpunkt eines Weltpunkts bei Maßstab s und Ursprung (ox, oy) */
export function project(cam: Camera, i: number, j: number, z: number, s = 1, ox = 0, oy = 0): Point {
  return [ox + (i * cam.CS - j * cam.SN) * IS * s, oy + ((i * cam.SN + j * cam.CS) * IS * cam.KY - z * cam.ZS) * s];
}

/** Tiefe eines Weltpunkts: größer = weiter vorn, wird später gezeichnet */
export function depthKey(cam: Camera, x: number, y: number, z: number): number {
  return (x * cam.SN + y * cam.CS) * Math.SQRT2 + z * 0.3;
}

/** Eine Ansicht: Kamera, Maßstab und Ursprung */
export interface View {
  readonly cam: Camera;
  readonly s: number;
  Q(i: number, j: number, z: number): Point;
  key(x: number, y: number, z: number): number;
}

export function makeView(cam: Camera, ox: number, oy: number, s: number): View {
  return {
    cam,
    s,
    Q: (i, j, z) => project(cam, i, j, z, s, ox, oy),
    key: (x, y, z) => depthKey(cam, x, y, z),
  };
}

export interface ScreenDir {
  readonly name: DirKey;
  readonly d: Dir;
  /** Bildschirmrichtung, Länge 1 */
  readonly x: number;
  readonly y: number;
}

/** Bildschirmrichtung je Gitterrichtung, für die gedrehten Pfeile des Steuerkreuzes */
export function screenDirs(cam: Camera): ScreenDir[] {
  const [x0, y0] = project(cam, 0, 0, 0);
  return (Object.entries(DIRS) as [DirKey, Dir][]).map(([name, d]) => {
    const [x1, y1] = project(cam, d[1], d[0], 0);
    const l = Math.hypot(x1 - x0, y1 - y0);
    return { name, d, x: (x1 - x0) / l, y: (y1 - y0) / l };
  });
}

/** Ausschnitt eines Feldes in Zellen (inklusive) */
export interface Area {
  readonly r0: number;
  readonly r1: number;
  readonly c0: number;
  readonly c1: number;
}

export interface FitOptions {
  /** verfügbare Breite (clientWidth des Elternelements); 0 oder fehlend = 600 */
  readonly width?: number;
  readonly maxS?: number;
  readonly maxH?: number;
  readonly pad?: number;
  /** ohne Rand aus Wasser (schmale Felder) */
  readonly noRing?: boolean;
  /** Oberkante des Rands (z. B. Wasser −0,3); ohne Wert gibt es keinen Rand */
  readonly ringZ?: number;
  /** höchster Punkt der Szene */
  readonly zmax?: number;
}

export interface Fit {
  /** Ausschnitt samt Rand */
  readonly area: Area;
  /** Rand in Zellen (0 oder 1) */
  readonly ring: 0 | 1;
  readonly zmin: number;
  readonly zmax: number;
  /** Bildbox bei Maßstab 1 */
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly s: number;
  /** Ursprung der Ansicht in CSS-px */
  readonly ox: number;
  readonly oy: number;
  /** Größe der Canvas in CSS-px */
  readonly w: number;
  readonly h: number;
}

/**
 * Maßstab und Ursprung, damit ein Feld samt Rand (eine Zelle) in die verfügbare Breite und Höhe passt. Die Bildbox
 * kommt aus den 8 Ecken des Quaders über dem Ausschnitt, von unter dem Rand bis über die Figuren.
 */
export function fitScene(cam: Camera, a: Area, o: FitOptions = {}): Fit {
  const ring = o.ringZ !== undefined && !o.noRing ? 1 : 0;
  const area = { r0: a.r0 - ring, r1: a.r1 + ring, c0: a.c0 - ring, c1: a.c1 + ring };
  const zmin = o.ringZ !== undefined && o.ringZ < 0 ? o.ringZ - 1 : -1;
  const zmax = o.zmax ?? 1.15;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const i of [area.c0, area.c1 + 1])
    for (const j of [area.r0, area.r1 + 1])
      for (const z of [zmin, zmax]) {
        const [x, y] = project(cam, i, j, z);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  const pad = o.pad ?? 8;
  const maxW = Math.max(200, (o.width || 600) - 24);
  let s = Math.max(0.3, Math.min(o.maxS || 1.4, (maxW - 2 * pad) / (x1 - x0)));
  if (o.maxH) s = Math.max(0.15, Math.min(s, (o.maxH - 2 * pad) / (y1 - y0)));
  return {
    area,
    ring,
    zmin,
    zmax,
    x0,
    x1,
    y0,
    y1,
    s,
    ox: pad - x0 * s,
    oy: pad - y0 * s,
    w: Math.ceil((x1 - x0) * s + 2 * pad),
    h: Math.ceil((y1 - y0) * s + 2 * pad),
  };
}
