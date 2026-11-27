import { describe, expect, it } from 'vitest';
import { depthKey, makeCamera, makeView } from './camera';
import { shade } from './geometry';
import { FWD, type Look, type Part, SIDE, cuboidFaces, eyes, humanoid, mir, modelCuboids, pair } from './models';

const cam = makeCamera(20, 50);
const LOOK: Look = {
  skin: '#f1c6a3',
  skinD: '#dea582',
  hand: '#f1c6a3',
  shoe: '#6e4527',
  legs: '#3b4150',
  hips: '#3b4150',
  torso: '#3e6e4c',
  sleeve: '#8db4d6',
  extra: (l) => [[0.1 + l, 0, 1, 0.1, 0.1, 0.1, '#ff0000']],
};

describe('mir und pair', () => {
  it('spiegelt zur Seite und tauscht s+ und s-', () => {
    expect(mir([0.1, 0.2, 0, 1, 0.3, 1, '#000'])).toEqual([0.1, -0.5, 0, 1, 0.3, 1, '#000']);
    expect(mir([0, 0.1, 0, 1, 0.1, 1, '#000', null, 's+'])[8]).toBe('s-');
    expect(mir([0, 0.1, 0, 1, 0.1, 1, '#000', null, 's-'])[8]).toBe('s+');
    expect(mir([0, 0.1, 0, 1, 0.1, 1, '#000', null, 'f'])[8]).toBe('f');
  });
  it('pair liefert das Teil und sein Spiegelbild', () => {
    const p: Part = [0, 0.1, 0, 1, 0.1, 1, '#000'];
    expect(pair(p)).toEqual([p, mir(p)]);
  });
  it('mir verändert das Teil nicht', () => {
    const p: Part = Object.freeze([0, 0.1, 0, 1, 0.1, 1, '#000', null, 's+'] as const);
    mir(p);
    expect(p[1]).toBe(0.1);
  });
});

describe('eyes', () => {
  it('zwei vorn, je eins an den Seiten, Standardfarbe #1d2233', () => {
    const e = eyes(0.15, 0.15, 0.83, 0.045, 0.05, 0.045);
    expect(e.map((p) => p[8])).toEqual(['f', 'f', 's+', 's-']);
    expect(e.every((p) => p[6] === '#1d2233')).toBe(true);
    expect(eyes(0, 0, 0, 0, 0, 0, '#123456')[0]![6]).toBe('#123456');
  });
});

describe('humanoid', () => {
  it('stand: 21 Teile plus Zusatz, Schuhhöhe 0,07 als Standard', () => {
    const P = humanoid(LOOK, 'stand', 0);
    expect(P).toHaveLength(21 + 1);
    expect(P[0]![5]).toBe(0.07);
    expect(P.at(-1)![6]).toBe('#ff0000');
    expect(humanoid({ ...LOOK, shoeH: 0.1 }, 'stand', 0)[0]![5]).toBe(0.1);
  });
  it('push: lehnt 0,04 vor und streckt die Arme waagerecht nach vorn', () => {
    const stand = humanoid(LOOK, 'stand', 0);
    const push = humanoid(LOOK, 'push', 0);
    // Rumpf
    expect(push[5]![0]).toBeCloseTo(stand[5]![0] + 0.04, 12);
    // Ärmel bei z 0,5, Hände vorn bei 0,2 + l
    expect(push[6]).toEqual([0.04, 0.155, 0.5, 0.2, 0.085, 0.1, LOOK.sleeve]);
    expect(push[8]![0]).toBeCloseTo(0.24, 12);
    // Zusatzteile bekommen das Vorlehnen
    expect(push.at(-1)![0]).toBeCloseTo(0.14, 12);
  });
  it('walk: Beine und Arme schwingen gegenläufig mit a', () => {
    const P = humanoid(LOOK, 'walk', 1);
    expect(P[2]![0]).toBeCloseTo(-0.06 + 0.07, 12);
    expect(P[6]![0]).toBeCloseTo(-0.06 - 0.06, 12);
    expect(humanoid(LOOK, 'stand', 1)[2]![0]).toBeCloseTo(-0.06, 12);
  });
});

describe('modelCuboids', () => {
  const block: Part = [0, 0, 0, 0.2, 0.4, 0.5, '#336699'];

  it('dreht ein Teil in Blickrichtung: vorn = FWD, seitlich = SIDE', () => {
    const [j] = modelCuboids(cam, [block], 5, 5, 0, 'j');
    // nach +j: Länge entlang j, Breite entlang -i
    expect(j).toMatchObject({ i0: 4.6, j0: 5, z0: 0, h: 0.5 });
    expect(j!.w).toBeCloseTo(0.4, 12);
    expect(j!.d).toBeCloseTo(0.2, 12);
    const [i] = modelCuboids(cam, [block], 5, 5, 0, 'i');
    expect(i).toMatchObject({ i0: 5, j0: 5 });
    expect(i!.w).toBeCloseTo(0.2, 12);
    expect(i!.d).toBeCloseTo(0.4, 12);
    expect(FWD.j).toEqual([0, 1]);
    expect(SIDE.j).toEqual([-1, 0]);
  });

  it('skaliert mit sc und hebt auf z', () => {
    const [c] = modelCuboids(cam, [block], 0, 0, 0.5, 'i', 2);
    expect(c).toMatchObject({ z0: 0.5, h: 1 });
    expect(c!.w).toBeCloseTo(0.4, 12);
  });

  it('zeichnet dünne Details nur, wenn ihre Fläche zur Kamera zeigt', () => {
    const front: Part = [0.1, 0, 0, 0.01, 0.1, 0.1, '#000', null, 'f'];
    const sPlus: Part = [0, 0.1, 0, 0.1, 0.01, 0.1, '#000', null, 's+'];
    const sMinus: Part = [0, -0.1, 0, 0.1, 0.01, 0.1, '#000', null, 's-'];
    const count = (dir: 'i' | '-i' | 'j' | '-j') => modelCuboids(cam, [front, sPlus, sMinus], 0, 0, 0, dir).length;
    // Blick zur Kamera (+j): vorn sichtbar, s+ zeigt nach -i (weg), s- nach +i (sichtbar)
    expect(count('j')).toBe(2);
    // Blick nach hinten (-j): vorn weg, s+ zeigt nach +i
    expect(count('-j')).toBe(1);
    // Blick nach rechts (+i): vorn sichtbar, s+ zeigt nach +j
    expect(count('i')).toBe(2);
    expect(count('-i')).toBe(1);
  });

  it('legt Details 0,002 vor ihren Mittelpunkt in der Tiefe; Grundkörper ohne Aufschlag', () => {
    const plain: Part = [0, 0, 0, 0.2, 0.2, 0.2, '#000'];
    const detail: Part = [0, 0, 0, 0.2, 0.2, 0.2, '#000', null, 'f'];
    const [a, b] = modelCuboids(cam, [plain, detail], 1, 1, 0, 'j');
    expect(a!.k).toBeCloseTo(depthKey(cam, a!.i0 + a!.w / 2, a!.j0 + a!.d / 2, 0.1), 12);
    expect(b!.k - a!.k).toBeCloseTo(0.002, 12);
  });

  it('übernimmt die Deckelfarbe', () => {
    const [c] = modelCuboids(cam, [[0, 0, 0, 1, 1, 1, '#000', '#fff']], 0, 0, 0, 'j');
    expect(c!.top).toBe('#fff');
    expect(modelCuboids(cam, [block], 0, 0, 0, 'j')[0]!.top).toBeNull();
  });
});

describe('cuboidFaces', () => {
  it('vorn −10 %, rechts −28 %, oben +5 % (Deckelfarbe, wenn gesetzt)', () => {
    const V = makeView(cam, 0, 0, 1);
    const c = { i0: 0, j0: 0, z0: 0, w: 1, d: 1, h: 1, col: '#808080', top: null };
    const [front, right, top] = cuboidFaces(V, c);
    expect(front!.fill).toBe(shade('#808080', -0.1));
    expect(right!.fill).toBe(shade('#808080', -0.28));
    expect(top!.fill).toBe(shade('#808080', 0.05));
    expect(front!.pts).toEqual([V.Q(0, 1, 1), V.Q(1, 1, 1), V.Q(1, 1, 0), V.Q(0, 1, 0)]);
    expect(cuboidFaces(V, { ...c, top: '#ff0000' })[2]!.fill).toBe(shade('#ff0000', 0.05));
  });
});
