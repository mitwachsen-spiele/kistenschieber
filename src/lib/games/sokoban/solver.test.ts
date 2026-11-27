import { describe, expect, it } from 'vitest';
import { DIRS, parseLevel } from './level';
import { CHECK_CAP, SOLVE_CAP, findPath, goalDist, reach, solve, solveRun } from './solver';

const at = (W: number, r: number, c: number) => r * W + c;
const OPEN = '#######\n#     #\n#  @  #\n#     #\n#######';

describe('reach', () => {
  it('findet alle begehbaren Felder ohne Kistenfelder', () => {
    const L = parseLevel('#######\n#@ $  #\n#######');
    expect(reach(L, new Set(L.boxes), L.player)).toEqual(new Set([at(7, 1, 1), at(7, 1, 2)]));
    expect(reach(L, new Set(), L.player).size).toBe(5);
  });
});

describe('findPath', () => {
  const L = parseLevel(OPEN);
  const W = L.W;

  it('liefert [] für from === to', () => {
    expect(findPath(L, new Set(), L.player, L.player)).toEqual([]);
  });

  it('liefert null, wenn Kisten den Weg versperren', () => {
    const M = parseLevel('#######\n#@$   #\n#######');
    expect(findPath(M, new Set(M.boxes), M.player, at(M.W, 1, 4))).toBeNull();
  });

  it('liefert null für ein Feld außerhalb', () => {
    expect(findPath(L, new Set(), L.player, at(W, 0, 0))).toBeNull();
  });

  it('liefert einen kürzesten Weg in D4-Reihenfolge', () => {
    expect(findPath(L, new Set(), L.player, at(W, 3, 4))).toEqual([DIRS.down, DIRS.right]);
    expect(findPath(L, new Set(), L.player, at(W, 1, 1))).toEqual([DIRS.up, DIRS.left, DIRS.left]);
    expect(findPath(L, new Set(), L.player, at(W, 2, 5))).toEqual([DIRS.right, DIRS.right]);
  });

  it('geht um Kisten herum', () => {
    const M = parseLevel('#####\n#@$ #\n#   #\n#####');
    expect(findPath(M, new Set(M.boxes), M.player, at(M.W, 1, 3))).toEqual([
      DIRS.down,
      DIRS.right,
      DIRS.right,
      DIRS.up,
    ]);
  });
});

describe('goalDist', () => {
  it('zählt Mindestschübe bis zum nächsten Ziel und kennt keine toten Felder', () => {
    const L = parseLevel('#######\n#.  @ #\n#######');
    const gd = goalDist(L);
    expect(gd.get(at(7, 1, 1))).toBe(0);
    expect(gd.get(at(7, 1, 2))).toBe(1);
    expect(gd.get(at(7, 1, 4))).toBe(3);
    expect(gd.has(at(7, 1, 5))).toBe(false);
  });
});

describe('solve', () => {
  it('meldet eine gelöste Stellung als { done }', () => {
    const L = parseLevel('#####\n#@ *#\n#####');
    expect(solve(L, L.boxes, L.player)).toEqual({ done: true });
    expect(solveRun(L, L.boxes, L.player).states).toBe(0);
  });

  it('liefert den ersten Schub einer Lösung', () => {
    const L = parseLevel('######\n#@$ .#\n######');
    expect(solve(L, L.boxes, L.player)).toEqual({ box: 0, d: DIRS.right });
  });

  it('läuft erst um die Kiste herum, wenn es von hier nicht geht', () => {
    const L = parseLevel('######\n#.$ @#\n######');
    expect(solve(L, L.boxes, L.player)).toEqual({ box: 0, d: DIRS.left });
  });

  it('liefert null für eine tote Stellung (Kiste in der Ecke ohne Ziel)', () => {
    const L = parseLevel('######\n#$  .#\n#  @ #\n######');
    expect(L.live.has(L.boxes[0]!)).toBe(false);
    expect(solve(L, L.boxes, L.player)).toBeNull();
  });

  it('liefert null, wenn die Kiste nur noch an einer Wand ohne Ziel entlang kann', () => {
    const L = parseLevel('#####\n#. ##\n#  $#\n#@  #\n#####');
    expect(solve(L, L.boxes, L.player)).toBeNull();
  });

  it('liefert null, wenn sich zwei Kisten gegenseitig sperren', () => {
    // Beide Kisten stehen auf lebenden Feldern an der Wand, aber jede braucht das Feld der anderen für die Figur
    const M = parseLevel('######\n#.$$.#\n#@   #\n######');
    expect(M.boxes.every((k) => M.live.has(k))).toBe(true);
    expect(solve(M, M.boxes, M.player)).toBeNull();
  });

  it('gibt bei zu kleiner Grenze { unknown } zurück', () => {
    const L = parseLevel('########\n#.    .#\n#  $$  #\n#  @   #\n########');
    const run = solveRun(L, L.boxes, L.player, 1);
    expect(run.result).toEqual({ unknown: true });
    expect(run.states).toBe(2);
  });

  it('nutzt die Grenzen aus dem Entwurf', () => {
    expect([SOLVE_CAP, CHECK_CAP]).toEqual([60000, 20000]);
  });

  it('findet eine schubkürzeste Lösung bei zwei Kisten', () => {
    const L = parseLevel(OPEN.replace('#  @  #', '#.$@$.#'));
    const first = solve(L, L.boxes, L.player);
    expect(first).toMatchObject({ box: 0, d: DIRS.left });
  });
});
