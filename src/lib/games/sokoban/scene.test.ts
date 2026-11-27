import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../oblique/rng';
import type { Part } from '../oblique/models';
import { DIRS, parseLevel, parseLurd } from './level';
import {
  BUMP_JERK,
  CONFETTI_LIFE,
  CONFETTI_PER_BOX,
  PUSH_OFFSET,
  animT,
  confetti,
  decoFor,
  gameWorld,
  staticLevelWorld,
  stepParticles,
  type Particle,
} from './scene';
import { DURATION, type Game, act, busy, newGame, tick, toggleSelect, tip } from './state';

/** Felder wie die Lektionen 1, 4 und 15 (lib kennt data/games nicht) */
const L1 = parseLevel('#########\n#       #\n# ##### #\n#.   $  #\n# ##### #\n#    @  #\n#########');
const L4 = parseLevel('########\n#      #\n#  $   #\n#  @   #\n#     .#\n########');
const L15 = parseLevel(' #########\n #@  #   #\n # $ $ $ #\n## ## ## #\n#  ...   #\n#  #*#  ##\n#       #\n#########');

let clock = 0;
/** Takte bis nichts mehr läuft */
function settle(g: Game): Game {
  let s = g;
  for (let i = 0; i < 1000 && busy(s); i++) s = tick(s, (clock += 1000));
  return s;
}
/** Züge (LURD) Schritt für Schritt spielen und warten, bis alles steht */
function play(g: Game, lurd: string): Game {
  let s = g;
  for (const { dir } of parseLurd(lurd)) s = settle(act(s, [dir], (clock += 1000)));
  return s;
}

const BOLLARD: Part[] = [[0, 0, 0, 0.2, 0.2, 0.2, '#2e3440']];
const GULL: Part[] = [[0, 0, 0, 0.1, 0.1, 0.1, '#ffffff']];
const LOOK = { bollard: BOLLARD, gull: GULL, wallHeight: 0.5 };

describe('gameWorld', () => {
  it('Ruhe: Figur in der Zellmitte, steht, schaut zur Kamera; Ausschnitt und Ziele wie das Feld', () => {
    const w = gameWorld(newGame(L1), 0);
    expect(w).toMatchObject({ r0: 0, r1: 6, c0: 0, c1: 8 });
    expect(w.figs).toEqual([{ x: 5.5, y: 5.5, z: 0, dir: 'j', pose: 'stand', a: 0 }]);
    expect(w.goals).toEqual([{ r: 3, c: 1 }]);
    expect(w.crates).toEqual([{ id: 0, x: 5, y: 3, ok: false, mark: null }]);
    expect(w.type(0, 0)).toBe('wall');
    expect(w.type(1, 1)).toBe('floor');
    expect(w.type(-1, 0)).toBe('out');
    expect(w.arrows).toEqual([]);
    expect(w.deco).toEqual([]);
    expect(w.fx).toEqual([]);
  });

  it('mitten im Schub steht die Figur 0,22 vor ihrer Position in Schub-Pose, die Kiste dazwischen', () => {
    const g = play(newGame(L1), 'rruul');
    const T = (clock += 1000);
    const s = act(g, [DIRS.left], T);
    expect(s.a?.kind).toBe('push');
    const w = gameWorld(s, T + DURATION.push / 2);
    const [fig] = w.figs;
    // von Spalte 6 nach 5, halb: 5,5; Blick nach -i, also 0,22 weiter links
    expect(fig!.x).toBeCloseTo(5.5 - PUSH_OFFSET + 0.5, 12);
    expect(fig!.y).toBeCloseTo(3.5, 12);
    expect(fig!.pose).toBe('push');
    expect(fig!.dir).toBe('-i');
    expect(PUSH_OFFSET).toBe(0.22);
    expect(w.crates[0]!.x).toBeCloseTo(4.5, 12);
    expect(w.crates[0]!.y).toBe(3);
  });

  it('Laufen: Schwung sin(t·π) mit wechselndem Schrittbein', () => {
    const T = (clock += 1000);
    const s = act(newGame(L1), [DIRS.right], T);
    const w = gameWorld(s, T + DURATION.walk / 2);
    expect(w.figs[0]!.pose).toBe('walk');
    expect(w.figs[0]!.x).toBeCloseTo(6, 12);
    const sign = s.a!.n % 2 ? 1 : -1;
    expect(w.figs[0]!.a).toBeCloseTo(sign, 12);
    const next = act(settle(s), [DIRS.right], (clock += 1000));
    expect(gameWorld(next, next.a!.t0 + DURATION.walk / 2).figs[0]!.a).toBeCloseTo(-sign, 12);
  });

  it('gegen die Wand: kurzer Ruck in Blickrichtung, Figur steht', () => {
    const T = (clock += 1000);
    const s = act(newGame(L1), [DIRS.up], T);
    expect(s.a?.kind).toBe('bump');
    const w = gameWorld(s, T + DURATION.bump / 2);
    expect(w.figs[0]!.y).toBeCloseTo(5.5 - BUMP_JERK, 12);
    expect(w.figs[0]!.pose).toBe('stand');
    expect(gameWorld(s, T + DURATION.bump).figs[0]!.y).toBeCloseTo(5.5, 12);
  });

  it('gegen eine blockierte Kiste: Ruck plus Schub-Pose 0,22 vor', () => {
    const g = play(newGame(L4), 'U');
    const T = (clock += 1000);
    const s = act(g, [DIRS.up], T);
    expect(s.a?.kind).toBe('blocked');
    const w = gameWorld(s, T + DURATION.blocked / 2);
    expect(w.figs[0]!.pose).toBe('push');
    expect(w.figs[0]!.y).toBeCloseTo(2 - BUMP_JERK - PUSH_OFFSET + 0.5, 12);
  });

  it('die Kiste wird erst nach dem Schieben grün', () => {
    const g = play(newGame(L1), 'rruulLLL');
    const T = (clock += 1000);
    const s = act(g, [DIRS.left], T);
    expect(gameWorld(s, T + 1).crates[0]!.ok).toBe(false);
    expect(gameWorld(s, T + DURATION.push).crates[0]!.ok).toBe(true);
  });

  it('animT: 0 am Anfang, 1 am Ende und ohne Animation', () => {
    const s = act(newGame(L1), [DIRS.right], 100);
    expect(animT(s, 100)).toBe(0);
    expect(animT(s, 100 + DURATION.walk * 3)).toBe(1);
    expect(animT(newGame(L1), 5)).toBe(1);
  });

  it('Markierung: festgefahren vor ausgewählt vor Tipp', () => {
    const g = newGame(L1);
    const mark = (s: Partial<Game>) => gameWorld({ ...g, ...s }, 0).crates[0]!.mark;
    expect(mark({ stuck: [0], sel: 0, hint: { box: 0, d: 'left' } })).toBe('stuck');
    expect(mark({ sel: 0, hint: { box: 0, d: 'left' } })).toBe('sel');
    expect(mark({ hint: { box: 0, d: 'left' } })).toBe('hint');
    expect(mark({ hint: { box: 1, d: 'left' } })).toBeNull();
  });

  it('Pfeile nur bei ausgewählter Kiste: je möglicher Richtung auf dem Feld dahinter', () => {
    const g = newGame(L1);
    expect(gameWorld(g, 0).arrows).toEqual([]);
    const sel = toggleSelect(g, 0);
    expect(gameWorld(sel, 0).arrows).toEqual([
      { r: 3, c: 4, d: DIRS.left, kind: 'sel' },
      { r: 3, c: 6, d: DIRS.right, kind: 'sel' },
    ]);
  });

  it('die Tipp-Richtung wird über den Namen erkannt und türkis', () => {
    const t = tip(newGame(L1));
    expect(t.hint).toEqual({ box: 0, d: 'left' });
    const arrows = gameWorld(t, 0).arrows;
    expect(arrows.map((a) => a.kind)).toEqual(['hint', 'sel']);
    // eine Kopie der Richtung (andere Array-Identität) ändert nichts
    const copy = { ...t, hint: { box: 0, d: 'left' as const } };
    expect(gameWorld(copy, 0).arrows[0]!.kind).toBe('hint');
  });

  it('ein Pfeil in eine Sackgasse ist grau (dead)', () => {
    const arrows = gameWorld(toggleSelect(newGame(L4), 0), 0).arrows;
    expect(arrows.find((a) => a.d === DIRS.up)).toEqual({ r: 1, c: 3, d: DIRS.up, kind: 'dead' });
    expect(arrows.find((a) => a.d === DIRS.left)?.kind).toBe('sel');
  });

  it('keine Pfeile während einer Animation oder nach dem Sieg', () => {
    const sel = toggleSelect(newGame(L1), 0);
    expect(gameWorld({ ...sel, a: { kind: 'bump', t0: 0, dur: 160, n: 1 } }, 0).arrows).toEqual([]);
    expect(gameWorld({ ...sel, won: true }, 0).arrows).toEqual([]);
    expect(gameWorld({ ...sel, sel: 7 }, 0).arrows).toEqual([]);
  });

  it('nimmt Schmuck und Teilchen des Aufrufers mit', () => {
    const deco = decoFor(L1, LOOK);
    const fx: Particle[] = [{ x: 1, y: 1, z: 1, vx: 0, vy: 0, vz: 0, col: '#fff', t0: 0 }];
    const w = gameWorld(newGame(L1), 0, { deco, fx });
    expect(w.deco).toBe(deco);
    expect(w.fx).toBe(fx);
  });

  it('verändert den Zustand nicht', () => {
    const g = Object.freeze(toggleSelect(newGame(L1), 0));
    expect(() => gameWorld(g, 0)).not.toThrow();
  });
});

describe('staticLevelWorld', () => {
  it('Startstellung, Figur steht und schaut zur Kamera, Kiste auf Ziel ist grün', () => {
    const w = staticLevelWorld(L15);
    expect(w.figs).toEqual([{ x: 2.5, y: 1.5, z: 0, dir: 'j', pose: 'stand', a: 0 }]);
    expect(w.crates.filter((c) => c.ok)).toEqual([{ id: 3, x: 4, y: 5, ok: true, mark: null }]);
    expect(w.crates).toHaveLength(4);
    expect(w.goals).toHaveLength(4);
    expect(w.arrows).toEqual([]);
    expect(w.fx).toEqual([]);
    expect(w).toMatchObject({ r0: 0, r1: 7, c0: 0, c1: 9 });
    expect(staticLevelWorld(L1, decoFor(L1, LOOK)).deco).toHaveLength(7);
  });
});

describe('decoFor', () => {
  it('Poller auf allen Ecken und Mitten, die Mauer sind; Möwe auf Platz 1 (oben rechts)', () => {
    const deco = decoFor(L1, LOOK);
    const bollards = deco.filter((d) => d.parts === BOLLARD);
    expect(bollards.map((d) => [d.y - 0.5, d.x - 0.5])).toEqual([
      [0, 0],
      [0, 8],
      [6, 0],
      [6, 8],
      [0, 4],
      [6, 4],
    ]);
    expect(bollards.every((d) => d.z === 0.5 && d.dir === 'j' && d.sc === 1)).toBe(true);
    const gulls = deco.filter((d) => d.parts === GULL);
    expect(gulls).toEqual([{ parts: GULL, x: 8.5, y: 0.5, z: 0.5 + 0.27, dir: '-i', sc: 1.2 }]);
  });

  it('nur auf Mauern: Leerfelder bekommen keinen Poller', () => {
    // Lektion 15: links oben ist leer, oben rechts Mauer
    const deco = decoFor(L15, LOOK);
    const spots = deco.filter((d) => d.parts === BOLLARD).map((d) => [d.y - 0.5, d.x - 0.5]);
    for (const [r, c] of spots) expect(L15.walls.has(r! * L15.W + c!)).toBe(true);
    expect(spots).not.toContainEqual([0, 0]);
    expect(deco.filter((d) => d.parts === GULL)).toHaveLength(1);
  });

  it('keine Möwe, wenn oben rechts keine Mauer ist', () => {
    const L = parseLevel('#### \n#@$.#\n#####');
    const deco = decoFor(L, LOOK);
    expect(deco.some((d) => d.parts === GULL)).toBe(false);
    expect(deco).toHaveLength(5);
  });
});

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
