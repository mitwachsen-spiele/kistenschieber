// Suche und Löser: erreichbare Felder, kürzester Laufweg und A* über Schübe. Rein und browser-sicher.
import { D4, type Dir, type Level, nb, opposite } from './level';

/** Grenze für Tipp und „Lösung zeigen“ (bekannte Stellungen) */
export const SOLVE_CAP = 60000;
/** Grenze für die Prüfung nach jedem Schub, ob es noch aufgeht */
export const CHECK_CAP = 20000;

/** Felder, die die Figur von p aus erreicht (Kisten sind Hindernis) */
export function reach(L: Level, boxSet: ReadonlySet<number>, p: number): Set<number> {
  const seen = new Set([p]);
  const q = [p];
  for (let k = q.pop(); k !== undefined; k = q.pop()) {
    for (const d of D4) {
      const n = nb(L, k, d);
      if (n >= 0 && L.inside.has(n) && !boxSet.has(n) && !seen.has(n)) {
        seen.add(n);
        q.push(n);
      }
    }
  }
  return seen;
}

/** Kürzester Laufweg ohne Schieben (Breitensuche in D4-Reihenfolge): [] wenn schon da, null wenn unerreichbar */
export function findPath(L: Level, boxSet: ReadonlySet<number>, from: number, to: number): Dir[] | null {
  if (from === to) return [];
  const prev = new Map<number, readonly [number, Dir] | null>([[from, null]]);
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const k = q[h]!;
    for (const d of D4) {
      const n = nb(L, k, d);
      if (n < 0 || !L.inside.has(n) || boxSet.has(n) || prev.has(n)) continue;
      prev.set(n, [k, d]);
      if (n === to) return pathTo(prev, n);
      q.push(n);
    }
  }
  return null;
}

function pathTo(prev: ReadonlyMap<number, readonly [number, Dir] | null>, end: number): Dir[] {
  const out: Dir[] = [];
  for (let step = prev.get(end); step; step = prev.get(step[0])) out.push(step[1]);
  return out.reverse();
}

/** Schubdistanz jedes Feldes zum nächsten Ziel (leeres Feld, rückwärts gezogen): Grundlage der A*-Schätzung */
export function goalDist(L: Level): Map<number, number> {
  const dist = new Map([...L.goals].map((g) => [g, 0]));
  const q = [...L.goals];
  for (let h = 0; h < q.length; h++) {
    const k = q[h]!;
    const dk = dist.get(k)!;
    for (const d of D4) {
      const b = nb(L, k, d);
      const p = nb(L, k, d, 2);
      if (b >= 0 && p >= 0 && L.inside.has(b) && L.inside.has(p) && !dist.has(b)) {
        dist.set(b, dk + 1);
        q.push(b);
      }
    }
  }
  return dist;
}

/** Erster Schub einer schubkürzesten Lösung, schon gelöst, Suche zu groß, oder null = unlösbar */
export type Solution = { readonly done: true } | { readonly box: number; readonly d: Dir } | { readonly unknown: true };
type FirstPush = { readonly box: number; readonly d: Dir };

interface Node {
  readonly f: number;
  readonly g: number;
  readonly arr: readonly number[];
  readonly p: number;
  readonly first: FirstPush | null;
  readonly goal: boolean;
}

/** Binärer Min-Heap auf f, ohne Gleichstands-Regel (wie im Entwurf: Reihenfolge bestimmt die erste Lösung) */
class Heap {
  private readonly items: Node[] = [];

  push(x: Node): void {
    const heap = this.items;
    heap.push(x);
    let i = heap.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      const parent = heap[j]!;
      if (parent.f <= x.f) break;
      heap[i] = parent;
      i = j;
    }
    heap[i] = x;
  }

  pop(): Node | undefined {
    const heap = this.items;
    const top = heap[0];
    if (!top) return undefined;
    const last = heap.pop()!;
    const n = heap.length;
    if (!n) return top;
    let i = 0;
    for (;;) {
      const m = this.smallerChild(i, last.f, n);
      if (m === i) break;
      heap[i] = heap[m]!;
      i = m;
    }
    heap[i] = last;
    return top;
  }

  private smallerChild(i: number, f: number, n: number): number {
    const l = 2 * i + 1;
    const r = l + 1;
    let m = i;
    let mv = f;
    if (l < n && this.items[l]!.f < mv) {
      m = l;
      mv = this.items[l]!.f;
    }
    if (r < n && this.items[r]!.f < mv) m = r;
    return m;
  }
}

const gdCache = new WeakMap<Level, Map<number, number>>();

/** Ergebnis samt Arbeit: wie viele Stellungen die Suche kennengelernt hat (für Tests ohne Wanduhr) */
export interface SolveRun {
  readonly result: Solution | null;
  readonly states: number;
}

/**
 * A* über Schübe; die Figur wird auf das kleinste Feld ihrer Region normalisiert. Die Schätzung „Summe der
 * Zielabstände“ unterschätzt nie, also ist die Lösung schubkürzest. Schübe auf Felder außerhalb von live entfallen.
 * Kennt die Suche mehr als cap Stellungen, gibt sie auf ({ unknown }).
 */
export function solveRun(L: Level, boxes: readonly number[], p: number, cap = SOLVE_CAP): SolveRun {
  const done = (arr: readonly number[]) => arr.every((k) => L.goals.has(k));
  if (done(boxes)) return { result: { done: true }, states: 0 };
  let gd = gdCache.get(L);
  if (!gd) gdCache.set(L, (gd = goalDist(L)));
  const est = estimate(gd);
  const best = new Map([[keyOf(boxes, norm(L, boxes, p)), 0]]);
  const heap = new Heap();
  heap.push({ f: est(boxes), g: 0, arr: boxes, p, first: null, goal: false });
  for (let s = heap.pop(); s; s = heap.pop()) {
    if (s.goal) return { result: s.first, states: best.size };
    const set = new Set(s.arr);
    const R = reach(L, set, s.p);
    for (let bi = 0; bi < s.arr.length; bi++) {
      for (const d of D4) {
        const na = pushed(L, s.arr, bi, d, set, R);
        if (!na) continue;
        const key = keyOf(na, norm(L, na, s.arr[bi]!));
        const g = s.g + 1;
        const known = best.get(key);
        if (known !== undefined && known <= g) continue;
        best.set(key, g);
        if (best.size > cap) return { result: { unknown: true }, states: best.size };
        const h = est(na);
        heap.push({ f: g + h, g, arr: na, p: s.arr[bi]!, first: s.first ?? { box: bi, d }, goal: h === 0 && done(na) });
      }
    }
  }
  return { result: null, states: best.size };
}

/** Erster Schub einer schubkürzesten Lösung (siehe solveRun) */
export function solve(L: Level, boxes: readonly number[], p: number, cap = SOLVE_CAP): Solution | null {
  return solveRun(L, boxes, p, cap).result;
}

/** Kisten nach einem Schub von Kiste bi in Richtung d, oder null, wenn der Schub nicht geht oder ins Aus führt */
function pushed(
  L: Level,
  arr: readonly number[],
  bi: number,
  d: Dir,
  set: ReadonlySet<number>,
  R: ReadonlySet<number>,
): number[] | null {
  const b = arr[bi]!;
  const from = nb(L, b, opposite(d));
  const to = nb(L, b, d);
  if (from < 0 || to < 0 || !R.has(from) || !L.inside.has(to) || set.has(to) || !L.live.has(to)) return null;
  const na = arr.slice();
  na[bi] = to;
  return na;
}

function estimate(gd: ReadonlyMap<number, number>): (arr: readonly number[]) => number {
  return (arr) => {
    let s = 0;
    for (const k of arr) {
      const v = gd.get(k);
      if (v === undefined) return Infinity;
      s += v;
    }
    return s;
  };
}

function norm(L: Level, arr: readonly number[], p: number): number {
  let m = Infinity;
  for (const k of reach(L, new Set(arr), p)) if (k < m) m = k;
  return m;
}

function keyOf(arr: readonly number[], n: number): string {
  return (
    arr
      .slice()
      .sort((a, b) => a - b)
      .join(',') + `|${n}`
  );
}
