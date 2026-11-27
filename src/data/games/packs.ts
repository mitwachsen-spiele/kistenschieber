// Die beiden Pakete des Spiels: e die Einführung mit ihren Lektionen, l die Level. Kennung im Speicher (best.e3, best.l2),
// Wort in Titeln und Knöpfen, und was ein Feld zum Spielen braucht.
import { LESSONS } from './lessons';
import { LEVELS } from './levels';

export type Pack = 'e' | 'l';

/** Wort für ein Feld des Pakets */
export const WORD = { e: 'Lektion', l: 'Level' } as const satisfies Record<Pack, string>;

/** Eine Lektion oder ein Level: Nummer, Sprungmarke, Titel, Feld und gespeicherte zugkürzeste Lösung */
export interface Puzzle {
  readonly n: number;
  readonly id: string;
  readonly title: string;
  readonly moves: number;
  readonly pushes: number;
  readonly sol: string;
  readonly xsb: string;
}

export const PUZZLES = { e: LESSONS, l: LEVELS } as const satisfies Record<Pack, readonly Puzzle[]>;

/** Zahl der Lektionen und der Level */
export const COUNTS = { e: LESSONS.length, l: LEVELS.length } as const satisfies Record<Pack, number>;
