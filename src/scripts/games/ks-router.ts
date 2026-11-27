// Bildschirme per Hash, rein und getestet: leer, #start und #spiel (Startlinks im Entwurf) zeigen den Start, #level die
// Levelwahl, #einstellungen die Einstellungen, #lektion-1 … #lektion-N eine Lektion der Einführung, #level-1 … #level-M
// ein Level. #level-N eines Levels, das es noch nicht gibt (Kapitel 1 und 2 haben 24), wird zu #level, Unbekanntes zum
// Start; beides ersetzt den Eintrag im Verlauf (`replace`), statt einen neuen anzulegen.
import { type Pack, WORD } from '../../data/games/packs';

export type Screen = 'start' | 'level' | 'einstellungen' | 'puzzle';

/** Zahl der Lektionen (e) und der Level (l) */
export type Counts = Readonly<Record<Pack, number>>;

export interface Route {
  readonly screen: Screen;
  /** Paket, nur bei `puzzle`: e eine Lektion, l ein Level */
  readonly pack: Pack | null;
  /** Nummer der Lektion oder des Levels, nur bei `puzzle` */
  readonly n: number | null;
  /** Titel des Tabs */
  readonly title: string;
  /** Hash, auf den die Adresse ohne neuen Verlaufseintrag umgeschrieben wird ('' = ohne Hash); null = bleibt */
  readonly replace: string | null;
}

const NAME = 'Kistenschieber';
const titled = (t: string) => `${t} · ${NAME}`;
/** Überschrift und Tab-Titel der Levelwahl */
export const LEVEL_TITLE = 'Level wählen';

const plain = (screen: Exclude<Screen, 'puzzle'>, title: string, replace: string | null = null): Route => ({
  screen,
  pack: null,
  n: null,
  title,
  replace,
});

/** Wohin ein Hash (mit oder ohne #) führt */
export function route(hash: string, counts: Counts): Route {
  const h = hash.replace(/^#/, '');
  if (h === '' || h === 'start' || h === 'spiel') return plain('start', NAME);
  if (h === 'level') return plain('level', titled(LEVEL_TITLE));
  if (h === 'einstellungen') return plain('einstellungen', titled('Einstellungen'));
  const m = /^(lektion|level)-([1-9]\d*)$/.exec(h);
  const pack: Pack = m?.[1] === 'level' ? 'l' : 'e';
  const n = m ? Number(m[2]) : 0;
  if (n >= 1 && n <= counts[pack])
    return { screen: 'puzzle', pack, n, title: titled(`${WORD[pack]} ${n}`), replace: null };
  if (/^level-\d+$/.test(h)) return plain('level', titled(LEVEL_TITLE), '#level');
  return plain('start', NAME, '');
}

/** Hash einer Lektion oder eines Levels */
export const puzzleHash = (pack: Pack, n: number): string => (pack === 'e' ? `#lektion-${n}` : `#level-${n}`);

/** Hash einer Lektion: Ziel von „Weiterspielen“ und „Zurück zum Spiel“ */
export const lessonHash = (n: number): string => puzzleHash('e', n);

/**
 * Ziel nach dem Sieg und beim Überspringen: die nächste Lektion, nach der letzten Level 1; das nächste Level. Ist das
 * Level noch nicht aufgegangen (`levelOpen`, Adventskalender) oder gibt es keins mehr, die Levelwahl
 */
export function nextHash(pack: Pack, n: number, counts: Counts, levelOpen: (n: number) => boolean): string {
  if (pack === 'e' && n < counts.e) return puzzleHash('e', n + 1);
  const k = pack === 'e' ? 1 : n + 1;
  return k <= counts.l && levelOpen(k) ? puzzleHash('l', k) : '#level';
}
