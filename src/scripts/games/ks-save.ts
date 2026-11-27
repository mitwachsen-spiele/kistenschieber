// Speicher von Kistenschieber im localStorage (Präfix `kistenschieber.`): Einstellungen und Fortschritt.
// Rein bis auf den übergebenen Speicher, damit testbar. Jeder Wert ist JSON und wird beim Lesen geprüft: Fehlendes,
// Falsches oder ein Speicher, der Fehler wirft (privates Fenster, voller Speicher), ergibt den Standardwert. Schreiben
// scheitert still, das Spiel läuft dann ohne Speichern weiter. Keine Migration (neue App, Spielstände dürfen verloren gehen).
import type { Best, Flag, ProgressKV } from '../../lib/games/sokoban/progress';

export const PREFIX = 'kistenschieber.';

/** Nur das, was vom localStorage gebraucht wird – in Tests ersetzbar */
export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type Hand = 'rechts' | 'links';
export type Ton = 'an' | 'aus';

export interface Settings {
  /** Drehung der Kamera in Grad */
  readonly drehung: number;
  /** Neigung der Kamera in Grad */
  readonly neigung: number;
  /** Seite des Steuerkreuzes */
  readonly hand: Hand;
  /** Töne des Spiels */
  readonly ton: Ton;
}

export const SETTINGS_DEFAULT: Settings = { drehung: 20, neigung: 50, hand: 'rechts', ton: 'an' };
export const RANGES = { drehung: [0, 45], neigung: [20, 80] } as const;

/** Schlüssel ohne Präfix */
export const KEYS = {
  best: (n: number) => `best.e${n}`,
  skip: (n: number) => `skip.e${n}`,
  shown: (n: number) => `shown.e${n}`,
  last: 'last',
} as const;

function read(store: Store, key: string): unknown {
  try {
    const v = store.getItem(PREFIX + key);
    return v === null ? null : (JSON.parse(v) as unknown);
  } catch {
    return null;
  }
}

function write(store: Store, key: string, value: unknown): void {
  try {
    store.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ohne Speicher geht es auch
  }
}

const inRange = (v: unknown, [lo, hi]: readonly [number, number]): v is number =>
  typeof v === 'number' && v >= lo && v <= hi;

const isHand = (v: unknown): v is Hand => v === 'rechts' || v === 'links';

const isTon = (v: unknown): v is Ton => v === 'an' || v === 'aus';

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Bestwert: ganze Zahlen, mindestens ein Zug, nicht mehr Schübe als Züge */
export function isBest(v: unknown): v is Best {
  if (typeof v !== 'object' || v === null) return false;
  const { moves, pushes } = v as Record<string, unknown>;
  return isCount(moves) && isCount(pushes) && moves >= 1 && pushes <= moves;
}

export function loadSettings(store: Store): Settings {
  const drehung = read(store, 'drehung');
  const neigung = read(store, 'neigung');
  const hand = read(store, 'hand');
  const ton = read(store, 'ton');
  return {
    drehung: inRange(drehung, RANGES.drehung) ? drehung : SETTINGS_DEFAULT.drehung,
    neigung: inRange(neigung, RANGES.neigung) ? neigung : SETTINGS_DEFAULT.neigung,
    hand: isHand(hand) ? hand : SETTINGS_DEFAULT.hand,
    ton: isTon(ton) ? ton : SETTINGS_DEFAULT.ton,
  };
}

export function saveSetting<K extends keyof Settings>(store: Store, key: K, value: Settings[K]): void {
  write(store, key, value);
}

/** Fortschritt über dem Speicher für lib/games/sokoban/progress.ts */
export function progressKV(store: Store): ProgressKV {
  return {
    best: (n) => {
      const v = read(store, KEYS.best(n));
      return isBest(v) ? { moves: v.moves, pushes: v.pushes } : null;
    },
    flag: (kind: Flag, n) => read(store, KEYS[kind](n)) === true,
    last: () => {
      const v = read(store, KEYS.last);
      return typeof v === 'string' && /^e[1-9]\d*$/.test(v) ? v : null;
    },
    setBest: (n, best) => write(store, KEYS.best(n), { moves: best.moves, pushes: best.pushes }),
    setFlag: (kind, n) => write(store, KEYS[kind](n), true),
    setLast: (ref) => write(store, KEYS.last, ref),
  };
}
