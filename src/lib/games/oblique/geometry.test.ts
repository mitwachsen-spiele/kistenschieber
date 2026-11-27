import { describe, expect, it } from 'vitest';
import { makeCamera, makeView } from './camera';
import { ARROW, type Hits, arrowPoly, ellipse, flatPts, hull, inPoly, pick, shade, square } from './geometry';
import { DIRS } from '../sokoban/level';

const V = makeView(makeCamera(20, 50), 100, 100, 1);
const centre = (pts: readonly (readonly [number, number])[]) => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

describe('Formen', () => {
  it('square: vier Ecken um die Mitte', () => {
    expect(square(1, 2, 0.5)).toEqual([
      [0.5, 1.5],
      [1.5, 1.5],
      [1.5, 2.5],
      [0.5, 2.5],
    ]);
  });
  it('ellipse: 16 Punkte, der erste rechts', () => {
    const e = ellipse(0, 0, 2, 1);
    expect(e).toHaveLength(16);
    expect(e[0]![0]).toBeCloseTo(2, 12);
    expect(e[4]![1]).toBeCloseTo(1, 12);
  });
  it('flatPts projiziert in Höhe z', () => {
    expect(flatPts(V, [[1, 1]], 0.5)).toEqual([V.Q(1, 1, 0.5)]);
  });
  it('hull: Sechseck aus Deckel hinten, rechter Kante und Vorderseite', () => {
    const h = hull(V, 0, 0, 0, 1, 1, 1);
    expect(h).toEqual([V.Q(0, 0, 1), V.Q(1, 0, 1), V.Q(1, 0, 0), V.Q(1, 1, 0), V.Q(0, 1, 0), V.Q(0, 1, 1)]);
  });
  it('inPoly: innen, außen, auf der anderen Seite', () => {
    const P = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ] as const;
    expect(inPoly(5, 5, P)).toBe(true);
    expect(inPoly(15, 5, P)).toBe(false);
    expect(inPoly(-1, 5, P)).toBe(false);
    expect(inPoly(5, 11, P)).toBe(false);
  });
});

describe('shade', () => {
  it('dunkelt mit f < 0 ab und hellt mit f > 0 Richtung Weiß auf', () => {
    expect(shade('#646464', -0.5)).toBe('rgb(50,50,50)');
    expect(shade('#000000', 0.5)).toBe('rgb(127,127,127)');
    expect(shade('#3e6e4c', -0.1)).toBe('rgb(55,99,68)');
    expect(shade('#ffffff', 0.05)).toBe('rgb(255,255,255)');
  });
  it('liefert aus dem Cache denselben Wert', () => {
    expect(shade('#123456', -0.28)).toBe(shade('#123456', -0.28));
  });
});

describe('Pfeil', () => {
  it('hat sieben Ecken, Spitze bei 0,3 vor der Mitte', () => {
    expect(ARROW).toHaveLength(7);
    expect(ARROW[3]).toEqual([0.3, 0]);
  });
  it('dreht in Schubrichtung: rechts zeigt nach +i, unten nach +j', () => {
    const right = arrowPoly(2, 3, DIRS.right);
    expect(right[3]![0]).toBeCloseTo(3.8, 12);
    expect(right[3]![1]).toBeCloseTo(2.5, 12);
    const down = arrowPoly(2, 3, DIRS.down);
    expect(down[3]![0]).toBeCloseTo(3.5, 12);
    expect(down[3]![1]).toBeCloseTo(2.8, 12);
    const up = arrowPoly(2, 3, DIRS.up);
    expect(up[3]![1]).toBeCloseTo(2.2, 12);
  });
  it('scale vergrößert um die Feldmitte und bleibt bei 1,5 im Feld', () => {
    const big = arrowPoly(2, 3, DIRS.right, 1.5);
    expect(big[3]![0]).toBeCloseTo(3.95, 12);
    expect(big[3]![1]).toBeCloseTo(2.5, 12);
    for (const [x, y] of big) {
      expect(x).toBeGreaterThan(3);
      expect(x).toBeLessThan(4);
      expect(y).toBeGreaterThan(2);
      expect(y).toBeLessThan(3);
    }
  });
});

describe('pick', () => {
  // Zeile 1: Mauer (0), Boden mit Kiste (1); Zeile 2: Boden (1) mit Figur, davor Kiste (2)
  const floors = [
    { r: 1, c: 1, poly: flatPts(V, square(1.5, 1.5, 0.5), 0) },
    { r: 2, c: 1, poly: flatPts(V, square(1.5, 2.5, 0.5), 0) },
    { r: 3, c: 1, poly: flatPts(V, square(1.5, 3.5, 0.5), 0) },
  ];
  const off = 0.1;
  const crate = (id: number, x: number, y: number) =>
    ({
      type: 'crate',
      id,
      k: V.key(x + 0.5, y + 0.5, 0.4),
      poly: hull(V, x + off, y + off, 0, 0.8, 0.8, 0.8),
    }) as const;
  const hits: Hits = {
    objs: [
      { type: 'wall', r: 0, c: 1, k: V.key(1.5, 0.5, 0.25), poly: hull(V, 1, 0, 0, 1, 1, 0.5) },
      crate(0, 1, 1),
      crate(1, 1, 3),
      { type: 'fig', k: V.key(1.5, 2.5, 0.5), poly: hull(V, 1.3, 2.3, 0, 0.4, 0.4, 1.05) },
    ],
    floors,
  };

  it('liefert die Kiste vor dem Boden darunter', () => {
    const [x, y] = V.Q(1.5, 1.5, 0.8);
    expect(pick(hits, x, y)).toMatchObject({ type: 'crate', id: 0 });
  });

  it('liefert bei Überlappung das vorderste Objekt', () => {
    // Oberkante der vorderen Kiste (Zeile 3) ragt in die Figur der Zeile davor
    const [x, y] = V.Q(1.5, 3.2, 0.8);
    const front = pick(hits, x, y);
    expect(front).toMatchObject({ type: 'crate', id: 1 });
    // auch wenn die Reihenfolge der Treffer anders ist
    const reversed: Hits = { objs: [...hits.objs].reverse(), floors };
    expect(pick(reversed, x, y)).toEqual(front);
  });

  it('ist nie eine Mauer: auf der Mauer zählt das Feld dahinter oder nichts', () => {
    const [x, y] = V.Q(1.5, 0.5, 0.5);
    expect(pick(hits, x, y)?.type).not.toBe('wall');
    const onlyWall: Hits = { objs: [hits.objs[0]!], floors: [] };
    expect(pick(onlyWall, x, y)).toBeNull();
  });

  it('liefert {type: floor, r, c} für einen Treffer auf einem Bodenfeld', () => {
    const onlyFloor: Hits = { objs: [], floors };
    const [x, y] = V.Q(1.5, 2.5, 0);
    expect(pick(onlyFloor, x, y)).toEqual({ type: 'floor', r: 2, c: 1 });
  });

  it('liefert null daneben und ohne Treffer-Daten', () => {
    expect(pick(hits, -500, -500)).toBeNull();
    expect(pick(null, 0, 0)).toBeNull();
  });

  it('die Mitte eines Bodenfelds liegt im eigenen Vieleck', () => {
    const [cx, cy] = centre(floors[0]!.poly);
    expect(inPoly(cx!, cy!, floors[0]!.poly)).toBe(true);
  });
});
