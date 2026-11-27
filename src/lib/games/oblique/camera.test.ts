import { describe, expect, it } from 'vitest';
import { CAM_DEFAULT, IS, clampCamera, depthKey, fitScene, makeCamera, makeView, project, screenDirs } from './camera';

const rad = (d: number) => (d * Math.PI) / 180;
/** Formel des Entwurfs: isoV(ox, oy, s).Q nach setCamera(yaw, tilt) */
function artifactQ(yaw: number, tilt: number, i: number, j: number, z: number, s = 1, ox = 0, oy = 0) {
  const CS = Math.cos(rad(yaw));
  const SN = Math.sin(rad(yaw));
  const KY = Math.sin(rad(tilt));
  const ZS = (44.8 * Math.cos(rad(tilt))) / Math.cos(Math.PI / 6);
  const S = 40 * Math.SQRT2;
  return [ox + (i * CS - j * SN) * S * s, oy + ((i * SN + j * CS) * S * KY - z * ZS) * s];
}

/** Feld von Lektion 1 (9 × 7); lib kennt data/games nicht */
const LESSON1 = { W: 9, H: 7 };

describe('makeCamera', () => {
  it('rechnet Maße wie setCamera im Entwurf', () => {
    const cam = makeCamera(20, 50);
    expect(IS).toBeCloseTo(56.5685, 4);
    expect(cam.CS).toBeCloseTo(Math.cos(rad(20)), 12);
    expect(cam.SN).toBeCloseTo(Math.sin(rad(20)), 12);
    expect(cam.KY).toBeCloseTo(Math.sin(rad(50)), 12);
    expect(cam.ZS).toBeCloseTo((44.8 * Math.cos(rad(50))) / Math.cos(Math.PI / 6), 12);
    expect(cam.IW).toBeCloseTo((cam.CS + cam.SN) * IS, 12);
    expect(cam.IT).toBeCloseTo((cam.CS + cam.SN) * cam.KY * IS, 12);
    expect(cam.key).toBe('20|50');
  });

  it('entspricht bei Neigung 30° den Maßen von Mitwachsen (Blockhöhe 44,8)', () => {
    expect(makeCamera(0, 30).ZS).toBeCloseTo(44.8, 9);
  });
});

describe('project', () => {
  it('trifft bei 20/50 die Formel des Entwurfs auf 1e-9', () => {
    const cam = makeCamera(CAM_DEFAULT.yaw, CAM_DEFAULT.tilt);
    for (const [i, j, z] of [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [3, 2, 1.15],
      [-1, 5, -1.3],
    ] as const) {
      const [x, y] = project(cam, i, j, z);
      const [ex, ey] = artifactQ(20, 50, i, j, z);
      expect(Math.abs(x - ex!)).toBeLessThan(1e-9);
      expect(Math.abs(y - ey!)).toBeLessThan(1e-9);
    }
    expect(project(cam, 0, 0, 0)).toEqual([0, 0]);
  });

  it('nimmt Maßstab und Ursprung mit; makeView ist dieselbe Projektion', () => {
    const cam = makeCamera(30, 40);
    const [x, y] = project(cam, 2, 3, 0.5, 0.7, 10, 20);
    const [ex, ey] = artifactQ(30, 40, 2, 3, 0.5, 0.7, 10, 20);
    expect(x).toBeCloseTo(ex!, 9);
    expect(y).toBeCloseTo(ey!, 9);
    const V = makeView(cam, 10, 20, 0.7);
    expect(V.Q(2, 3, 0.5)).toEqual([x, y]);
    expect(V.s).toBe(0.7);
    expect(V.key(1, 2, 3)).toBe(depthKey(cam, 1, 2, 3));
  });
});

describe('depthKey', () => {
  const cam = makeCamera(20, 50);
  it('ordnet vordere Zellen hinter die hinteren (größer = später gezeichnet)', () => {
    expect(depthKey(cam, 0.5, 2.5, 0)).toBeGreaterThan(depthKey(cam, 0.5, 1.5, 0));
    expect(depthKey(cam, 2.5, 0.5, 0)).toBeGreaterThan(depthKey(cam, 1.5, 0.5, 0));
    expect(depthKey(cam, 1, 1, 1)).toBeCloseTo(depthKey(cam, 1, 1, 0) + 0.3, 12);
  });
  it('rechnet wie der Entwurf: (x·SN + y·CS)·√2 + z·0,3', () => {
    expect(depthKey(cam, 2, 3, 0.4)).toBeCloseTo((2 * cam.SN + 3 * cam.CS) * Math.SQRT2 + 0.12, 12);
  });
});

describe('screenDirs', () => {
  it('bildet bei Drehung 0 rechts auf +x und unten auf +y ab', () => {
    const dirs = Object.fromEntries(screenDirs(makeCamera(0, 50)).map((d) => [d.name, d]));
    expect(dirs.right!.x).toBeCloseTo(1, 12);
    expect(dirs.right!.y).toBeCloseTo(0, 12);
    expect(dirs.down!.x).toBeCloseTo(0, 12);
    expect(dirs.down!.y).toBeCloseTo(1, 12);
    expect(dirs.left!.x).toBeCloseTo(-1, 12);
    expect(dirs.up!.y).toBeCloseTo(-1, 12);
  });
  it('liefert die vier Richtungen in der Reihenfolge von DIRS, jede mit Länge 1', () => {
    const dirs = screenDirs(makeCamera(20, 50));
    expect(dirs.map((d) => d.name)).toEqual(['up', 'down', 'left', 'right']);
    for (const d of dirs) expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 12);
    // gedreht: rechts zeigt etwas nach unten
    expect(dirs[3]!.y).toBeGreaterThan(0);
  });
});

/** Bildbox aus den 8 Ecken, unabhängig nachgerechnet */
function box(cam: ReturnType<typeof makeCamera>, c0: number, c1: number, r0: number, r1: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const i of [c0, c1 + 1])
    for (const j of [r0, r1 + 1])
      for (const z of [-1.3, 1.15]) {
        const [x, y] = artifactQ(cam.yaw, cam.tilt, i, j, z);
        xs.push(x!);
        ys.push(y!);
      }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

describe('fitScene', () => {
  const cam = makeCamera(20, 50);
  const area = { r0: 0, r1: LESSON1.H - 1, c0: 0, c1: LESSON1.W - 1 };

  it('Lektion 1 mit Rand: Box aus den 8 Ecken eine Zelle weiter, z von −1,3 bis 1,15', () => {
    const f = fitScene(cam, area, { ringZ: -0.3, width: 800 });
    expect(f.ring).toBe(1);
    expect(f.area).toEqual({ r0: -1, r1: LESSON1.H, c0: -1, c1: LESSON1.W });
    expect(f.zmin).toBeCloseTo(-1.3, 12);
    expect(f.zmax).toBe(1.15);
    const b = box(cam, -1, LESSON1.W, -1, LESSON1.H);
    expect(f.x0).toBeCloseTo(b.x0, 9);
    expect(f.x1).toBeCloseTo(b.x1, 9);
    expect(f.y0).toBeCloseTo(b.y0, 9);
    expect(f.y1).toBeCloseTo(b.y1, 9);
  });

  it('Lektion 1 ohne Rand (schmal): Box genau über dem Feld, zmin bleibt −1,3', () => {
    const f = fitScene(cam, area, { ringZ: -0.3, noRing: true, width: 800 });
    expect(f.ring).toBe(0);
    expect(f.area).toEqual(area);
    expect(f.zmin).toBeCloseTo(-1.3, 12);
    const b = box(cam, 0, LESSON1.W - 1, 0, LESSON1.H - 1);
    expect(f.x0).toBeCloseTo(b.x0, 9);
    expect(f.y1).toBeCloseTo(b.y1, 9);
  });

  it('ohne Rand-Höhe: zmin −1 und kein Rand', () => {
    const f = fitScene(cam, area);
    expect(f.zmin).toBe(-1);
    expect(f.ring).toBe(0);
  });

  it('Maßstab: (maxW − 2·pad) / Breite, geklemmt auf [0,3, maxS]; Ursprung und Größe wie im Entwurf', () => {
    const f = fitScene(cam, area, { ringZ: -0.3, width: 500, pad: 8 });
    const s = (500 - 24 - 16) / (f.x1 - f.x0);
    expect(f.s).toBeCloseTo(Math.min(1.4, s), 12);
    expect(f.ox).toBeCloseTo(8 - f.x0 * f.s, 9);
    expect(f.oy).toBeCloseTo(8 - f.y0 * f.s, 9);
    expect(f.w).toBe(Math.ceil((f.x1 - f.x0) * f.s + 16));
    expect(f.h).toBe(Math.ceil((f.y1 - f.y0) * f.s + 16));
    // sehr breit: maxS
    expect(fitScene(cam, area, { width: 5000, maxS: 1.1 }).s).toBe(1.1);
    expect(fitScene(cam, area, { width: 5000 }).s).toBe(1.4);
    // sehr schmal: mindestens 0,3 (maxW ist mindestens 200)
    expect(fitScene(cam, { r0: 0, r1: 40, c0: 0, c1: 40 }, { width: 10 }).s).toBe(0.3);
    // ohne Breite gilt 600
    expect(fitScene(cam, area).s).toBe(fitScene(cam, area, { width: 600 }).s);
  });

  it('mit maxH: höchstens (maxH − 2·pad) / Höhe, aber mindestens 0,15', () => {
    const f = fitScene(cam, area, { width: 5000, maxH: 200, pad: 4 });
    expect(f.s).toBeCloseTo((200 - 8) / (f.y1 - f.y0), 12);
    expect(fitScene(cam, area, { width: 5000, maxH: 10 }).s).toBe(0.15);
    expect(fitScene(cam, area, { width: 300, maxH: 5000 }).s).toBe(fitScene(cam, area, { width: 300 }).s);
  });
});

describe('clampCamera', () => {
  it('behält gültige Werte und setzt ungültige auf 20/50 zurück', () => {
    expect(clampCamera(0, 80)).toEqual({ yaw: 0, tilt: 80 });
    expect(clampCamera(45, 20)).toEqual({ yaw: 45, tilt: 20 });
    expect(clampCamera(-1, 81)).toEqual({ yaw: 20, tilt: 50 });
    expect(clampCamera(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ yaw: 20, tilt: 50 });
  });
});
