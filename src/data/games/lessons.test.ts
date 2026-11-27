import { describe, expect, it } from 'vitest';
import { type Dir, cellType, nb, opposite, parseLevel, parseLurd } from '../../lib/games/sokoban/level';
import { CHECK_CAP, findPath, solve, solveRun } from '../../lib/games/sokoban/solver';
import { LESSONS } from './lessons';

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
 * Arbeit des Lösers von der Startstellung unter der Spiel-Grenze 20000: bekannte Stellungen je Lektion.
 * Obergrenze: Mehr Stellungen heißt, der Löser ist langsamer geworden (Arbeit statt Wanduhr, stabil auch mit
 * Abdeckung auf 2 CPUs). Weniger Arbeit ist erlaubt; dann die Zahlen gern neu messen und senken.
 */
const STATES = [6, 7, 40, 14, 5, 5, 28, 45, 68, 76, 67, 69, 442, 301, 821];

describe('Lektionen', () => {
  it('sind 15, nummeriert, mit id lektion-N', () => {
    expect(LESSONS.map((l) => l.n)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(LESSONS.map((l) => l.id)).toEqual(LESSONS.map((l) => `lektion-${l.n}`));
  });

  it('übernehmen Titel und Texte aus dem Entwurf', () => {
    expect(LESSONS[0]).toMatchObject({
      title: 'Erster Schubs',
      idea: 'Laufen und schieben: eine Kiste, ein Ziel.',
      intro: 'Schieb die Kiste auf das gelbe Feld.',
    });
    expect(LESSONS[14]).toMatchObject({
      title: 'Meisterstück',
      intro: 'Das Meisterstück. Nimm dir Zeit, „Zug zurück“ hilft immer.',
    });
    for (const l of LESSONS) expect([l.title, l.idea, l.intro].every((t) => t.length > 0)).toBe(true);
  });

  it.each(LESSONS)('Lektion $n: höchstens 10 breit und 9 hoch, je Kiste ein Ziel', (l) => {
    const L = parseLevel(l.xsb);
    expect(L.W).toBeLessThanOrEqual(10);
    expect(L.H).toBeLessThanOrEqual(9);
    expect(L.boxes.length).toBe(L.goals.size);
  });

  it.each(LESSONS)('Lektion $n: sol gewinnt mit genau moves Zügen und pushes Schüben', (l) => {
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

  it('Lektion 15 liest * als Kiste auf Ziel', () => {
    const L = parseLevel(LESSONS[14]!.xsb);
    const star = 5 * L.W + 4;
    expect(LESSONS[14]!.xsb.split('\n')[5]![4]).toBe('*');
    expect(L.boxes).toContain(star);
    expect(L.goals.has(star)).toBe(true);
  });

  it.each([13, 15])('Lektion %i: Leerfelder vor der Mauer sind nicht begehbar', (n) => {
    const L = parseLevel(LESSONS[n - 1]!.xsb);
    expect(LESSONS[n - 1]!.xsb.startsWith(' ')).toBe(true);
    const type = cellType(L);
    let checked = 0;
    for (const [r, row] of LESSONS[n - 1]!.xsb.split('\n').entries()) {
      const lead = row.length - row.trimStart().length;
      for (let c = 0; c < L.W; c++) {
        if (c >= lead && c < row.length) continue;
        const k = r * L.W + c;
        expect(L.inside.has(k), `Zeile ${r}, Spalte ${c}`).toBe(false);
        expect(type(r, c), `Zeile ${r}, Spalte ${c}`).toBe('out');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1);
  });

  it.each(LESSONS)('Lektion $n: Ecken ohne Ziel sind nicht live', (l) => {
    const L = parseLevel(l.xsb);
    const wall = (k: number) => k < 0 || L.walls.has(k);
    for (const k of L.inside) {
      const vert = wall(nb(L, k, [-1, 0])) || wall(nb(L, k, [1, 0]));
      const horiz = wall(nb(L, k, [0, -1])) || wall(nb(L, k, [0, 1]));
      if (vert && horiz && !L.goals.has(k)) expect(L.live.has(k), `Feld ${k}`).toBe(false);
    }
  });

  it.each(LESSONS)('Lektion $n: der Löser findet von der Startstellung einen ersten Schub unter 20000', (l) => {
    const L = parseLevel(l.xsb);
    const run = solveRun(L, L.boxes, L.player, CHECK_CAP);
    expect(run.result).toHaveProperty('box');
    expect(run.states).toBeLessThanOrEqual(STATES[l.n - 1]!);
    expect(run.states).toBeLessThan(CHECK_CAP);
  });

  it.each(LESSONS)('Lektion $n: dem Löser Schub für Schub folgen gewinnt mit höchstens pushes Schüben', (l) => {
    const L = parseLevel(l.xsb);
    const boxes = [...L.boxes];
    let p = L.player;
    let pushes = 0;
    for (let first = solve(L, boxes, p); first && 'box' in first; first = solve(L, boxes, p)) {
      const b = boxes[first.box]!;
      const behind = nb(L, b, opposite(first.d));
      const walk = findPath(L, new Set(boxes), p, behind);
      expect(walk, `Schub ${pushes + 1}: kein Weg hinter die Kiste`).not.toBeNull();
      for (const d of walk!) {
        const r = step(L, boxes, p, d);
        expect(r?.push, `Schub ${pushes + 1}: der Weg schiebt nicht`).toBe(false);
        p = r!.p;
      }
      expect(p).toBe(behind);
      const to = nb(L, b, first.d);
      expect(L.live.has(to), `Schub ${pushes + 1}: Ziel ist tot`).toBe(true);
      const r = step(L, boxes, p, first.d);
      expect(r?.push, `Schub ${pushes + 1} geht nicht`).toBe(true);
      expect(boxes[first.box]).toBe(to);
      p = r!.p;
      pushes++;
    }
    expect(solve(L, boxes, p)).toEqual({ done: true });
    expect(pushes).toBeLessThanOrEqual(l.pushes);
  });
});
