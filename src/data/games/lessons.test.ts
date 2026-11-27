import { describe, expect, it } from 'vitest';
import { type Dir, cellType, nb, opposite, parseLevel, parseLurd } from '../../lib/games/sokoban/level';
import { CHECK_CAP, findPath, solve, solveRun } from '../../lib/games/sokoban/solver';
import { type ProgressKV, markShown, recordWin, stateOf } from '../../lib/games/sokoban/progress';
import { gameWorld } from '../../lib/games/sokoban/scene';
import {
  AUTO_SLOWER,
  DURATION,
  type Game,
  busy,
  dirKey,
  newGame,
  options,
  showSolution,
  step as play,
  tick,
  tip,
} from '../../lib/games/sokoban/state';
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
    });
    expect(LESSONS[14]).toMatchObject({ title: 'Meisterstück' });
    for (const l of LESSONS) expect([l.title, l.idea].every((t) => t.length > 0)).toBe(true);
    // Keine Lektionshinweise auf dem Schild mehr (Issue #11): die Lektion trägt keinen Intro-Text
    for (const l of LESSONS) expect(l).not.toHaveProperty('intro');
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

/** Fortschritt im Arbeitsspeicher */
function memoryKV(): ProgressKV & { readonly data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    best: () => null,
    flag: (kind, n) => data.get(`${kind}.e${n}`) === true,
    last: () => null,
    setBest: (n, best) => void data.set(`best.e${n}`, best),
    setFlag: (kind, n) => void data.set(`${kind}.e${n}`, true),
    setLast: (n) => void data.set('last', n),
  };
}

describe('Lektionen im Spielzustand', () => {
  it.each(LESSONS)('Lektion $n: Tipp auf dem Start zeigt Kiste und Richtung wie solve()', (l) => {
    const g = Object.freeze(newGame(parseLevel(l.xsb), { sol: l.sol }));
    const r = solve(g.L, g.boxes, g.p);
    if (!r || !('box' in r)) throw new Error('Startstellung muss lösbar sein');
    expect(tip(g)).toMatchObject({ sel: r.box, hint: { box: r.box, d: dirKey(r.d) }, msg: 'tip' });
  });

  it.each(LESSONS)('Lektion $n: „Lösung zeigen“ spielt sol bis zum Sieg, ohne Bestwert', (l) => {
    const kv = memoryKV();
    let t = 0;
    let g = Object.freeze(showSolution(newGame(parseLevel(l.xsb), { sol: l.sol }), t));
    expect(g).toMatchObject({ auto: true, solutionShown: true, msg: 'showing' });
    expect(g.hist).toHaveLength(1);
    expect(g.a?.dur).toBe(DURATION[g.a!.kind] * AUTO_SLOWER);
    for (let i = 0; i < 1000 && busy(g); i++) g = Object.freeze(tick(g, (t += 1000)));
    expect(g).toMatchObject({ won: true, shownWin: true, confetti: false, msg: 'shownWin', moves: l.moves });
    expect(g.pushes).toBe(l.pushes);
    expect(recordWin(kv, l.n, { moves: g.moves, pushes: g.pushes, shown: g.shownWin })).toBe(false);
    expect(kv.data.has(`best.e${l.n}`)).toBe(false);
    markShown(kv, l.n);
    expect(stateOf(kv, l.n)).toBe('shown');
  });
});

/** Lektion n nach den Zügen lurd (ohne Animation) */
function after(n: number, lurd = ''): Game {
  const l = LESSONS[n - 1]!;
  let g = newGame(parseLevel(l.xsb), { sol: l.sol });
  for (const { dir } of parseLurd(lurd)) g = play(g, dir).game;
  return g;
}

/** Pfeile nach dem Tipp; dazu, ob der gezeigte Schub die Stellung lösbar lässt */
function tipArrows(g: Game) {
  const t = tip(g);
  const box = t.hint!.box;
  const k = t.boxes[box]!;
  const arrows = gameWorld(t, 0).arrows;
  const solvable = arrows.map((a) => {
    const boxes = t.boxes.slice();
    boxes[box] = nb(t.L, k, a.d);
    return solve(t.L, boxes, k, CHECK_CAP) !== null;
  });
  return { t, arrows, solvable, legal: options(t, box).map(dirKey) };
}

// Issue #14: Nach „Tipp“ zeigte die Kiste alle möglichen Pfeile, der Tipp war nur türkis. Auf dem Handy las sich das
// wie „hoch oder runter“, obwohl hoch die Kiste an die Wand bringt (Lektion 6 am Start).
describe('Tipp: genau ein Pfeil, ein erlaubter Schub, danach noch lösbar', () => {
  it.each(LESSONS)('Lektion $n am Start', (l) => {
    const { t, arrows, solvable, legal } = tipArrows(after(l.n));
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toMatchObject({ kind: 'hint' });
    expect(dirKey(arrows[0]!.d)).toBe(t.hint!.d);
    expect(legal).toContain(t.hint!.d);
    expect(solvable).toEqual([true]);
  });

  it('Lektion 6 am Start (Fall des Nutzers): möglich wären hoch und runter, gezeigt wird nur runter', () => {
    const { t, arrows, legal } = tipArrows(after(6));
    expect(legal).toEqual(['up', 'down']);
    expect(arrows.map((a) => dirKey(a.d))).toEqual(['down']);
    expect(t.hint!.d).toBe('down');
  });

  it('Lektion 2 am Start: vier mögliche Richtungen, ein Pfeil', () => {
    const { arrows, legal } = tipArrows(after(2));
    expect(legal).toHaveLength(4);
    expect(arrows.map((a) => [dirKey(a.d), a.kind])).toEqual([['right', 'hint']]);
  });

  it('Lektion 3 nach lUUrddrUU: nur links aufs Ziel, nicht rechts neben die andere Kiste (unlösbar)', () => {
    const { arrows, solvable, legal } = tipArrows(after(3, 'lUUrddrUU'));
    expect(legal).toContain('right');
    expect(arrows.map((a) => [dirKey(a.d), a.kind])).toEqual([['left', 'hint']]);
    expect(solvable).toEqual([true]);
  });
});
