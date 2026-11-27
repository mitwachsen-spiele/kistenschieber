// Fortschritt eines Pakets (Einführung oder Level): Status je Feld, Freischalten der Reihe nach, wo es weitergeht,
// Bestwerte. Rein: Der Speicher kommt als Schnittstelle herein (im Browser scripts/games/ks-save.ts, im Test eine Map)
// und liefert nur geprüfte Werte; dazu optional, ob ein Feld schon aufgegangen ist (Kalender der Level). Felder zählen
// ab 1, `count` ist ihre Zahl. Die Namen sagen „Lektion“, gelten aber für beide Pakete.

export interface Best {
  readonly moves: number;
  readonly pushes: number;
}

/** übersprungen oder mit Lösung gesehen */
export type Flag = 'skip' | 'shown';

export interface ProgressKV {
  best(n: number): Best | null;
  flag(kind: Flag, n: number): boolean;
  /** Nummer der zuletzt geöffneten Lektion */
  last(): number | null;
  setBest(n: number, best: Best): void;
  setFlag(kind: Flag, n: number): void;
  setLast(n: number): void;
  /** Ist der Tag von Lektion n gekommen (Adventskalender)? Ohne: immer */
  open?(n: number): boolean;
}

export type LessonState = 'done' | 'shown' | 'skipped' | 'open';

/** Status: geschafft (Bestwert) vor mit Lösung gesehen vor übersprungen vor offen */
export function stateOf(kv: ProgressKV, n: number): LessonState {
  if (kv.best(n)) return 'done';
  if (kv.flag('shown', n)) return 'shown';
  return kv.flag('skip', n) ? 'skipped' : 'open';
}

/** Ist der Tag von Lektion n gekommen? Ohne Kalender immer */
export const dayCome = (kv: ProgressKV, n: number): boolean => kv.open?.(n) ?? true;

/** Frei, wenn ihr Tag gekommen ist und sie dran ist: Lektion 1 dann immer, sonst wenn die vorige nicht mehr offen ist */
export function unlocked(kv: ProgressKV, n: number): boolean {
  return dayCome(kv, n) && (n <= 1 || stateOf(kv, n - 1) !== 'open');
}

export function doneCount(kv: ProgressKV, count: number): number {
  let done = 0;
  for (let n = 1; n <= count; n++) if (kv.best(n)) done++;
  return done;
}

/** Übersprungen und noch nicht nachgeholt (weder gelöst noch mit Lösung gesehen) */
export function skippedCount(kv: ProgressKV, count: number): number {
  let skipped = 0;
  for (let n = 1; n <= count; n++) if (stateOf(kv, n) === 'skipped') skipped++;
  return skipped;
}

/** Erste freie offene Lektion, sonst 0 */
export function nextOpen(kv: ProgressKV, count: number): number {
  for (let n = 1; n <= count; n++) if (unlocked(kv, n) && stateOf(kv, n) === 'open') return n;
  return 0;
}

/** Erste freie offene Lektion; ist keine mehr offen, die letzte freie (ohne Kalender die letzte), sonst 1 */
export function firstPlayable(kv: ProgressKV, count: number): number {
  const n = nextOpen(kv, count);
  if (n) return n;
  for (let k = count; k > 1; k--) if (unlocked(kv, k)) return k;
  return 1;
}

/** Zuletzt geöffnete Lektion, wenn es sie gibt und sie frei ist, sonst 0 */
function lastOpened(kv: ProgressKV, count: number): number {
  const n = kv.last() ?? 0;
  return n >= 1 && n <= count && unlocked(kv, n) ? n : 0;
}

/** Wo es weitergeht: die zuletzt geöffnete Lektion, wenn es sie gibt und sie frei ist, sonst firstPlayable */
export function lastRef(kv: ProgressKV, count: number): number {
  return lastOpened(kv, count) || firstPlayable(kv, count);
}

/** Lektion geöffnet: nur eine freie wird als letzte gemerkt */
export function markOpened(kv: ProgressKV, n: number): boolean {
  if (!unlocked(kv, n)) return false;
  kv.setLast(n);
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

/**
 * Schon angefangen? Dann heißt der große Knopf „Weiterspielen“: Eine Lektion ist nicht mehr offen, oder es geht bei
 * einer späteren als der ersten weiter. Sonst „Spielen“
 */
export function started(kv: ProgressKV, count: number): boolean {
  for (let n = 1; n <= count; n++) if (stateOf(kv, n) !== 'open') return true;
  return lastRef(kv, count) > 1;
}

/** Zustand einer Karte in der Levelwahl: gesperrt oder der Status der Lektion */
export type CardState = LessonState | 'locked';

export const cardState = (kv: ProgressKV, n: number): CardState => (unlocked(kv, n) ? stateOf(kv, n) : 'locked');

/**
 * Einführung geschafft (Haken auf Start und Levelwahl): Jede Lektion ist selbst gelöst oder mit Lösung gesehen.
 * Übersprungene zählen nicht, sie bleiben zum Nachholen
 */
export function introComplete(kv: ProgressKV, count: number): boolean {
  for (let n = 1; n <= count; n++) {
    const s = stateOf(kv, n);
    if (s !== 'done' && s !== 'shown') return false;
  }
  return true;
}

/** Ziel des großen Knopfs auf dem Startbildschirm; `repeat`: die geschaffte Einführung von vorn */
export interface StartPoint {
  readonly n: number;
  readonly repeat: boolean;
}

/**
 * Wohin der große Knopf auf dem Startbildschirm führt. Geschafft: „Einführung wiederholen“ (Lektion 1), außer eine
 * Wiederholung läuft schon (zuletzt geöffnet eine vor der letzten), dann geht es dort weiter. Nicht geschafft, aber
 * eine Lektion noch offen: lastRef. Nichts mehr offen: zur ersten übersprungenen, zum Nachholen; nur so führt der
 * Knopf zum Haken
 */
export function startPoint(kv: ProgressKV, count: number): StartPoint {
  const last = lastOpened(kv, count);
  if (introComplete(kv, count)) return last >= 1 && last < count ? { n: last, repeat: false } : { n: 1, repeat: true };
  let skipped = 0;
  for (let n = count; n >= 1; n--) {
    const s = stateOf(kv, n);
    if (s === 'open') return { n: lastRef(kv, count), repeat: false };
    if (s === 'skipped') skipped = n;
  }
  return { n: skipped || lastRef(kv, count), repeat: false };
}
