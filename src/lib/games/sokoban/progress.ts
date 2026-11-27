// Fortschritt der Einführung: Status je Lektion, Freischalten der Reihe nach, wo es weitergeht, Bestwerte.
// Rein: Der Speicher kommt als Schnittstelle herein (im Browser scripts/games/ks-save.ts, im Test eine Map) und
// liefert nur geprüfte Werte. Lektionen zählen ab 1, `count` ist die Zahl der Lektionen.

export interface Best {
  readonly moves: number;
  readonly pushes: number;
}

/** übersprungen oder mit Lösung gesehen */
export type Flag = 'skip' | 'shown';

export interface ProgressKV {
  best(n: number): Best | null;
  flag(kind: Flag, n: number): boolean;
  /** zuletzt geöffnete Lektion als 'e<N>' */
  last(): string | null;
  setBest(n: number, best: Best): void;
  setFlag(kind: Flag, n: number): void;
  setLast(ref: string): void;
}

export type LessonState = 'done' | 'shown' | 'skipped' | 'open';

/** Status: geschafft (Bestwert) vor mit Lösung gesehen vor übersprungen vor offen */
export function stateOf(kv: ProgressKV, n: number): LessonState {
  if (kv.best(n)) return 'done';
  if (kv.flag('shown', n)) return 'shown';
  return kv.flag('skip', n) ? 'skipped' : 'open';
}

/** Der Reihe nach frei: Lektion 1 immer, sonst wenn die vorige nicht mehr offen ist */
export function unlocked(kv: ProgressKV, n: number): boolean {
  return n <= 1 || stateOf(kv, n - 1) !== 'open';
}

export function doneCount(kv: ProgressKV, count: number): number {
  let done = 0;
  for (let n = 1; n <= count; n++) if (kv.best(n)) done++;
  return done;
}

/** Erste freie offene Lektion; ist keine mehr offen, die letzte */
export function firstPlayable(kv: ProgressKV, count: number): number {
  for (let n = 1; n <= count; n++) if (unlocked(kv, n) && stateOf(kv, n) === 'open') return n;
  return count;
}

export const refOf = (n: number): string => `e${n}`;

/** Wo es weitergeht: die zuletzt geöffnete Lektion, wenn es sie gibt und sie frei ist, sonst firstPlayable */
export function lastRef(kv: ProgressKV, count: number): number {
  const m = /^e(\d+)$/.exec(kv.last() ?? '');
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= count && unlocked(kv, n) ? n : firstPlayable(kv, count);
}

/** Lektion geöffnet: nur eine freie wird als letzte gemerkt */
export function markOpened(kv: ProgressKV, n: number): boolean {
  if (!unlocked(kv, n)) return false;
  kv.setLast(refOf(n));
  return true;
}

/**
 * Sieg merken: neuer Bestwert bei weniger Zügen oder gleich vielen Zügen mit weniger Schüben. Ein vorgespielter
 * Sieg („Lösung zeigen“) zählt nie
 */
export function recordWin(kv: ProgressKV, n: number, result: Best & { readonly shown: boolean }): boolean {
  if (result.shown) return false;
  const b = kv.best(n);
  if (b && (result.moves > b.moves || (result.moves === b.moves && result.pushes >= b.pushes))) return false;
  kv.setBest(n, { moves: result.moves, pushes: result.pushes });
  return true;
}

/** Überspringen merken, aber nur ohne Bestwert */
export function markSkipped(kv: ProgressKV, n: number): boolean {
  if (kv.best(n)) return false;
  kv.setFlag('skip', n);
  return true;
}

/** „Lösung zeigen“ merken, sofort beim Start des Vorspielens: Es macht die nächste Lektion frei */
export function markShown(kv: ProgressKV, n: number): void {
  kv.setFlag('shown', n);
}
