import { describe, expect, it } from 'vitest';
import { type Dir, nb, opposite, parseLevel, parseLurd } from '../../lib/games/sokoban/level';
import { CHECK_CAP, SOLVE_CAP, findPath, solve, solveRun } from '../../lib/games/sokoban/solver';
import { AUTO_SLOWER, DURATION, busy, dirKey, newGame, showSolution, tick, tip } from '../../lib/games/sokoban/state';
import { LEVELS, isOpen, openCount, opensAt } from './levels';

/** Ein Schritt nach den Sokoban-Regeln: laufen, schieben oder (null) geht nicht */
function step(L: ReturnType<typeof parseLevel>, boxes: number[], p: number, d: Dir) {
  const to = nb(L, p, d);
  if (to < 0 || !L.inside.has(to)) return null;
  const bi = boxes.indexOf(to);
  if (bi < 0) return { p: to, push: false };
  const behind = nb(L, to, d);
  if (behind < 0 || !L.inside.has(behind) || boxes.includes(behind)) return null;
  boxes[bi] = behind;
  return { p: to, push: true };
}

/**
 * Arbeit des Lösers von der Startstellung unter der Spiel-Grenze 20000: bekannte Stellungen je Level (gemessen).
 * Mehr heißt, der Löser ist langsamer geworden; weniger ist erlaubt
 */
const STATES = [84, 62, 103, 220, 119, 236];

describe('Level', () => {
  it('sind 6, nummeriert, mit id level-N, Titel wörtlich aus dem Entwurf', () => {
    expect(LEVELS.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(LEVELS.map((l) => l.id)).toEqual(LEVELS.map((l) => `level-${l.n}`));
    expect(LEVELS.map((l) => l.title)).toEqual([
      'Anleger',
      'Poller',
      'Laufsteg',
      'Taurolle',
      'Ladekante',
      'Hafenbecken',
    ]);
  });

  it.each(LEVELS)('Level $n: höchstens 10 breit und 9 hoch, 2 bis 3 Kisten, je Kiste ein Ziel, nur Kisten', (l) => {
    const L = parseLevel(l.xsb);
    expect(L.W).toBeLessThanOrEqual(10);
    expect(L.H).toBeLessThanOrEqual(9);
    expect(L.boxes.length).toBeGreaterThanOrEqual(2);
    expect(L.boxes.length).toBeLessThanOrEqual(3);
    expect(L.boxes.length).toBe(L.goals.size);
    // Schranke, Schalter, Luke und Tor (_ T v D) kommen erst ab Level 7
    expect(l.xsb).toMatch(/^[#.$*@+ \n]+$/);
  });

  it.each(LEVELS)('Level $n: sol gewinnt mit genau moves Zügen und pushes Schüben', (l) => {
    const L = parseLevel(l.xsb);
    const boxes = [...L.boxes];
    let p = L.player;
    let pushes = 0;
    const steps = parseLurd(l.sol);
    for (const [i, s] of steps.entries()) {
      const r = step(L, boxes, p, s.dir);
      expect(r, `Zug ${i + 1} geht nicht`).not.toBeNull();
      expect(r!.push, `Zug ${i + 1}: Großbuchstabe genau bei Schub`).toBe(s.push);
      p = r!.p;
      if (r!.push) pushes++;
    }
    expect(steps.length).toBe(l.moves);
    expect(pushes).toBe(l.pushes);
    expect(boxes.every((k) => L.goals.has(k))).toBe(true);
  });

  it.each(LEVELS)('Level $n: der Löser findet von der Startstellung einen ersten Schub unter 20000', (l) => {
    const L = parseLevel(l.xsb);
    const run = solveRun(L, L.boxes, L.player, CHECK_CAP);
    expect(run.result).toHaveProperty('box');
    expect(run.states).toBeLessThanOrEqual(STATES[l.n - 1]!);
  });

  it.each(LEVELS)('Level $n: dem Löser Schub für Schub folgen gewinnt mit höchstens pushes Schüben', (l) => {
    const L = parseLevel(l.xsb);
    const boxes = [...L.boxes];
    let p = L.player;
    let pushes = 0;
    for (let first = solve(L, boxes, p, SOLVE_CAP); first && 'box' in first; first = solve(L, boxes, p, SOLVE_CAP)) {
      const b = boxes[first.box]!;
      const behind = nb(L, b, opposite(first.d));
      const walk = findPath(L, new Set(boxes), p, behind);
      expect(walk, `Schub ${pushes + 1}: kein Weg hinter die Kiste`).not.toBeNull();
      for (const d of walk!) p = step(L, boxes, p, d)!.p;
      const r = step(L, boxes, p, first.d);
      expect(r?.push, `Schub ${pushes + 1} geht nicht`).toBe(true);
      p = r!.p;
      pushes++;
    }
    expect(solve(L, boxes, p)).toEqual({ done: true });
    expect(pushes).toBeLessThanOrEqual(l.pushes);
  });

  it.each(LEVELS)('Level $n: Tipp am Start wie solve(), „Lösung zeigen“ spielt sol bis zum Sieg', (l) => {
    const g0 = Object.freeze(newGame(parseLevel(l.xsb), { sol: l.sol }));
    const r = solve(g0.L, g0.boxes, g0.p);
    if (!r || !('box' in r)) throw new Error('Startstellung muss lösbar sein');
    expect(tip(g0)).toMatchObject({ sel: r.box, hint: { box: r.box, d: dirKey(r.d) }, msg: 'tip' });
    let t = 0;
    let g = Object.freeze(showSolution(g0, t));
    expect(g.a?.dur).toBe(DURATION[g.a!.kind] * AUTO_SLOWER);
    for (let i = 0; i < 1000 && busy(g); i++) g = Object.freeze(tick(g, (t += 1000)));
    expect(g).toMatchObject({ won: true, shownWin: true, moves: l.moves, pushes: l.pushes });
  });
});

describe('Adventskalender', () => {
  it('Level N geht am N. Dezember 2026 auf', () => {
    expect(LEVELS.map((l) => l.opens)).toEqual(LEVELS.map((l) => `2026-12-0${l.n}`));
  });

  it('um 0 Uhr deutscher Zeit (Winterzeit, UTC+1), unabhängig von der Uhr des Geräts', () => {
    for (const l of LEVELS) expect(opensAt(l.n)).toBe(Date.UTC(2026, 10, 29 + l.n, 23));
    const midnight = Date.UTC(2026, 10, 30, 23);
    expect(isOpen(1, midnight - 1)).toBe(false);
    expect(isOpen(1, midnight)).toBe(true);
    expect(isOpen(2, midnight)).toBe(false);
  });

  it('ein unbekanntes Level geht nie auf', () => {
    expect(opensAt(0)).toBe(Infinity);
    expect(opensAt(7)).toBe(Infinity);
    expect(isOpen(7, Date.UTC(2030, 0, 1))).toBe(false);
  });

  it('openCount: vor dem 1. Dezember keins, dann eins mehr pro Tag, ab dem 6. alle sechs', () => {
    expect(openCount(Date.UTC(2026, 10, 27, 12))).toBe(0);
    expect(openCount(Date.UTC(2026, 10, 30, 23))).toBe(1);
    expect(openCount(Date.UTC(2026, 11, 3, 12))).toBe(3);
    expect(openCount(Date.UTC(2026, 11, 5, 23))).toBe(6);
    expect(openCount(Date.UTC(2027, 0, 1))).toBe(6);
  });
});
