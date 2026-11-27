import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../oblique/rng';
import { parseLevel } from './level';
import { CONFETTI_LIFE, CONFETTI_PER_BOX, confetti, stepParticles } from './confetti';
import type { Particle } from './scene';

/** Felder wie die Lektionen 1 und 15 (lib kennt data/games nicht) */
const L1 = parseLevel('#########\n#       #\n# ##### #\n#.   $  #\n# ##### #\n#    @  #\n#########');
const L15 = parseLevel(' #########\n #@  #   #\n # $ $ $ #\n## ## ## #\n#  ...   #\n#  #*#  ##\n#       #\n#########');

describe('Konfetti', () => {
  it('18 Teilchen je Kiste ab der Kistenmitte in Höhe 0,9, Farben reihum', () => {
    const cols = ['#a', '#b', '#c', '#d'];
    const ps = confetti(L1, [L1.goals.values().next().value!], 500, () => 0.5, cols);
    expect(ps).toHaveLength(CONFETTI_PER_BOX);
    expect(ps[0]).toMatchObject({ x: 1.5, y: 3.5, z: 0.9, col: '#a', t0: 500 });
    expect(ps[0]!.vx).toBeCloseTo(-1, 12);
    expect(ps[0]!.vz).toBeCloseTo(2.9, 12);
    expect(ps.map((p) => p.col).slice(0, 5)).toEqual(['#a', '#b', '#c', '#d', '#a']);
    expect(confetti(L15, L15.boxes, 0, mulberry32(1), cols)).toHaveLength(4 * 18);
  });

  it('Tempo 0,6 bis 1,4, Steigen 2,2 bis 3,6 (Zufall vom Aufrufer)', () => {
    const ps = confetti(L15, L15.boxes, 0, mulberry32(7), ['#fff']);
    for (const p of ps) {
      const v = Math.hypot(p.vx, p.vy);
      expect(v).toBeGreaterThanOrEqual(0.6 - 1e-9);
      expect(v).toBeLessThan(1.4);
      expect(p.vz).toBeGreaterThanOrEqual(2.2);
      expect(p.vz).toBeLessThan(3.6);
    }
    expect(confetti(L1, [0], 0, () => 0, [])[0]!.col).toBe('#ffffff');
  });

  it('stepParticles: fliegt mit dt, fällt mit Schwerkraft 6', () => {
    const p: Particle = { x: 0, y: 0, z: 1, vx: 1, vy: 2, vz: 3, col: '#fff', t0: 0 };
    const [n] = stepParticles([p], 100, 0.5);
    expect(n).toEqual({ ...p, x: 0.5, y: 1, z: 2.5, vz: 0 });
    expect(stepParticles([p], 100)[0]!.vz).toBeCloseTo(3 - 6 / 60, 12);
  });

  it('stepParticles: weg nach 1400 ms oder unter z −0,1', () => {
    const p: Particle = { x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, col: '#fff', t0: 1000 };
    expect(stepParticles([p], 1000 + CONFETTI_LIFE - 1)).toHaveLength(1);
    expect(stepParticles([p], 1000 + CONFETTI_LIFE)).toHaveLength(0);
    expect(stepParticles([{ ...p, z: -0.09, vz: -1 }], 1000)).toHaveLength(0);
    expect(stepParticles([{ ...p, z: 0, vz: 0 }], 1000)).toHaveLength(1);
    expect(CONFETTI_LIFE).toBe(1400);
  });

  it('verändert die Eingabe nicht', () => {
    const ps = Object.freeze([Object.freeze({ x: 0, y: 0, z: 1, vx: 1, vy: 1, vz: 1, col: '#fff', t0: 0 })]);
    expect(() => stepParticles(ps, 10)).not.toThrow();
    expect(ps[0]!.x).toBe(0);
  });
});
