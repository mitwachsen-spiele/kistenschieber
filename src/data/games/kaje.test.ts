import { describe, expect, it } from 'vitest';
import { makeCamera } from '../../lib/games/oblique/camera';
import { humanoid, modelCuboids } from '../../lib/games/oblique/models';
import { granit, kai, klinker, wasser, wasserSeite } from '../../lib/games/oblique/textures';
import { decoFor, staticLevelWorld } from '../../lib/games/sokoban/scene';
import { parseLevel } from '../../lib/games/sokoban/level';
import {
  ARROW_FILL,
  BLOCK_HEIGHT,
  BOLLARD,
  CONFETTI,
  FRAUKE,
  FRAUKE_TEXT,
  GOAL,
  GULL,
  INK,
  K,
  KAJE_BLOCKS,
  KAJE_DECO,
  MARK,
  RING_Z,
  SHADOW,
  WH,
} from './kaje';
import { LESSONS } from './lessons';

describe('Stil „An der Kaje“', () => {
  it('Maße wie im Entwurf: Mauer halbhoch, Kiste 0,8, Wasser 0,3 unter dem Boden', () => {
    expect([WH, K, RING_Z]).toEqual([0.5, 0.8, -0.3]);
    expect(BLOCK_HEIGHT).toEqual({ floor: 1, wall: 0.5, crate: 1, crateOk: 1, ring: 1 });
  });

  it('Texturen je Block', () => {
    expect(KAJE_BLOCKS.floor).toEqual({ top: klinker, side: granit });
    expect(KAJE_BLOCKS.wall).toEqual({ top: kai, side: granit });
    expect(KAJE_BLOCKS.ring).toEqual({ top: wasser, side: wasserSeite });
    expect(KAJE_BLOCKS.crate.top.name).toBe('kiste');
    expect(KAJE_BLOCKS.crate.side.name).toBe('kiste-strebe');
    expect(KAJE_BLOCKS.crateOk.top.name).toBe('kiste-ok-haken');
    expect(KAJE_BLOCKS.crateOk.side.name).toBe('kiste-ok-strebe');
  });

  it('Ziel: Quadrate 0,38 Tinte, 0,31 Gelb, 0,15 Tinte übereinander', () => {
    expect(INK).toBe('#1d2838');
    expect(GOAL.map((g) => [g.half, g.col])).toEqual([
      [0.38, INK],
      [0.31, '#ffd23f'],
      [0.15, INK],
    ]);
    expect(GOAL.map((g) => g.z)).toEqual([0.004, 0.006, 0.008]);
  });

  it('Markierungen und Pfeile', () => {
    expect(MARK).toEqual({ sel: '#f0a531', hint: '#2ec4b6', stuck: '#e0442f' });
    expect(ARROW_FILL).toEqual({ hint: '#2ec4b6', sel: '#f0a531', dead: '#a3aab3' });
  });

  it('Schatten und Konfetti', () => {
    expect(SHADOW.crate.map((s) => [s.half, s.alpha])).toEqual([
      [0.56, 0.07],
      [0.5, 0.08],
      [0.45, 0.1],
    ]);
    expect(SHADOW.contact.from).toBe('rgba(20,24,34,.32)');
    expect(SHADOW.figure).toMatchObject({ rx: 0.34, ry: 0.3 });
    expect(CONFETTI).toEqual(['#ffd23f', '#3c9656', '#ffffff', '#f0a531']);
  });
});

describe('Frauke', () => {
  it('Farben und Beschreibung wie im Entwurf', () => {
    expect(FRAUKE).toMatchObject({
      skin: '#f1c6a3',
      skinD: '#dea582',
      shoe: '#6e4527',
      shoeH: 0.1,
      legs: '#3b4150',
      torso: '#3e6e4c',
      sleeve: '#8db4d6',
    });
    expect(FRAUKE_TEXT).toBe(
      'Rote Wollmütze mit Bommel, Zopf, grüne Weste mit Taschen über hellblauem Hemd, feste Stiefel.',
    );
  });

  it('Mütze mit Bommel ganz oben (1,11), Zopf hinten, alles lehnt beim Schieben mit', () => {
    const parts = humanoid(FRAUKE, 'stand', 0);
    expect(parts).toHaveLength(21 + 13);
    const top = Math.max(...parts.map((p) => p[2] + p[5]));
    expect(top).toBeCloseTo(1.11, 12);
    const bommel = parts.find((p) => p[6] === '#f3eee4')!;
    expect(bommel[2] + bommel[5]).toBeCloseTo(1.11, 12);
    const pushed = humanoid(FRAUKE, 'push', 0).find((p) => p[6] === '#f3eee4')!;
    expect(pushed[0]).toBeCloseTo(bommel[0] + 0.04, 12);
  });

  it('von vorn sind Gesicht und Weste zu sehen, von hinten nicht', () => {
    const cam = makeCamera(20, 50);
    const front = modelCuboids(cam, humanoid(FRAUKE, 'stand', 0), 0, 0, 0, 'j');
    const back = modelCuboids(cam, humanoid(FRAUKE, 'stand', 0), 0, 0, 0, '-j');
    expect(front.some((c) => c.col === '#a0473a')).toBe(true);
    expect(back.some((c) => c.col === '#a0473a')).toBe(false);
  });
});

describe('Schmuck', () => {
  it('Poller aus drei Lagen, Möwe mit Schnabel und Augen', () => {
    expect(BOLLARD.map((p) => p[6])).toEqual(['#2e3440', '#3a414e', '#4a5262']);
    expect(GULL.filter((p) => p[6] === '#f2b52c')).toHaveLength(3);
    expect(GULL.filter((p) => p[6] === '#1d2233')).toHaveLength(4);
    expect(GULL).toHaveLength(12);
  });

  it('jede Lektion bekommt Poller nur auf Mauern', () => {
    for (const lesson of LESSONS) {
      const L = parseLevel(lesson.xsb);
      const deco = decoFor(L, KAJE_DECO);
      for (const d of deco) expect(L.walls.has((d.y - 0.5) * L.W + (d.x - 0.5))).toBe(true);
      expect(deco.filter((d) => d.parts === GULL).length).toBeLessThanOrEqual(1);
      expect(staticLevelWorld(L, deco).deco).toBe(deco);
    }
  });
});
