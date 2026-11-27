import { describe, expect, it } from 'vitest';
import { D4, DIRS, cellType, dirName, nb, opposite, parseLevel, parseLurd } from './level';

const at = (W: number, r: number, c: number) => r * W + c;

describe('parseLevel', () => {
  it('liest Wände, Ziele, Kisten und Figur; Breite ist die längste Zeile', () => {
    const L = parseLevel('#####\n#@$.#\n#####');
    expect([L.W, L.H]).toEqual([5, 3]);
    expect(L.player).toBe(at(5, 1, 1));
    expect(L.boxes).toEqual([at(5, 1, 2)]);
    expect([...L.goals]).toEqual([at(5, 1, 3)]);
    expect(L.walls.size).toBe(12);
  });

  it('liest * als Kiste auf Ziel und + als Figur auf Ziel; Kisten in Lesereihenfolge', () => {
    const L = parseLevel('######\n#+ $*#\n######');
    expect(L.player).toBe(at(6, 1, 1));
    expect(L.goals.has(at(6, 1, 1))).toBe(true);
    expect(L.boxes).toEqual([at(6, 1, 3), at(6, 1, 4)]);
    expect(L.goals.has(at(6, 1, 4))).toBe(true);
  });

  it('füllt kurze Zeilen mit Leer auf und zählt Leerfelder außerhalb der Mauern nicht als begehbar', () => {
    const L = parseLevel(' ###\n##@#\n###');
    expect(L.W).toBe(4);
    expect(L.inside).toEqual(new Set([at(4, 1, 2)]));
    const type = cellType(L);
    expect(type(0, 0)).toBe('out');
    expect(type(2, 3)).toBe('out');
    expect(type(1, 2)).toBe('floor');
    expect(type(1, 0)).toBe('wall');
    expect(type(-1, 0)).toBe('out');
    expect(type(0, 4)).toBe('out');
    expect(type(3, 0)).toBe('out');
    expect(type(0, -1)).toBe('out');
  });

  it('lehnt ein Level ohne Figur ab', () => {
    expect(() => parseLevel('###\n#$#\n###')).toThrow(/ohne Figur/);
  });

  it('live schließt Ecken ohne Ziel aus und behält Ziele, auch in Ecken', () => {
    const L = parseLevel('######\n#.   #\n#  @ #\n#    #\n######');
    const W = L.W;
    expect(L.live.has(at(W, 1, 1))).toBe(true); // Ziel in der Ecke
    expect(L.live.has(at(W, 1, 4))).toBe(false); // Ecke oben rechts
    expect(L.live.has(at(W, 3, 1))).toBe(false); // Ecke unten links
    expect(L.live.has(at(W, 3, 4))).toBe(false); // Ecke unten rechts
    expect(L.live.has(at(W, 1, 3))).toBe(true); // an der Wand mit dem Ziel
    expect(L.live.has(at(W, 3, 2))).toBe(false); // an der Wand ohne Ziel
    expect(L.live.has(at(W, 2, 2))).toBe(true);
  });
});

describe('Nachbarn und Richtungen', () => {
  const size = { W: 4, H: 3 };

  it('nb geht n Schritte und liefert -1 außerhalb des Rechtecks', () => {
    expect(nb(size, at(4, 1, 1), DIRS.right)).toBe(at(4, 1, 2));
    expect(nb(size, at(4, 1, 1), DIRS.down)).toBe(at(4, 2, 1));
    expect(nb(size, at(4, 1, 1), DIRS.right, 2)).toBe(at(4, 1, 3));
    expect(nb(size, at(4, 1, 1), DIRS.right, 3)).toBe(-1);
    expect(nb(size, at(4, 0, 0), DIRS.up)).toBe(-1);
    expect(nb(size, at(4, 0, 0), DIRS.left)).toBe(-1);
    expect(nb(size, at(4, 2, 0), DIRS.down)).toBe(-1);
  });

  it('D4 behält die Reihenfolge oben, unten, links, rechts', () => {
    expect(D4).toEqual([
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]);
  });

  it('dirName gibt die Blickrichtung in Weltachsen', () => {
    expect(D4.map(([dr, dc]) => dirName(dr, dc))).toEqual(['-j', 'j', '-i', 'i']);
  });

  it('opposite kehrt um, ohne -0', () => {
    expect(opposite(DIRS.up)).toEqual(DIRS.down);
    expect(Object.is(opposite(DIRS.left)[0], 0)).toBe(true);
    expect(opposite(DIRS.left)).toEqual(DIRS.right);
  });
});

describe('parseLurd', () => {
  it('Großbuchstabe ist ein Schub, Kleinbuchstabe ein Laufschritt', () => {
    expect(parseLurd('uDlR')).toEqual([
      { dir: DIRS.up, push: false },
      { dir: DIRS.down, push: true },
      { dir: DIRS.left, push: false },
      { dir: DIRS.right, push: true },
    ]);
  });

  it('lehnt unbekannte Zeichen ab', () => {
    expect(() => parseLurd('ux')).toThrow(/Unbekannter Zug „x“/);
  });
});
