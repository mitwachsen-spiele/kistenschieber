// Bildschirme per Hash, rein und getestet: leer, #start und #spiel (Startlinks im Entwurf) zeigen den Start, #level die
// Levelwahl, #einstellungen die Einstellungen, #lektion-1 … #lektion-N eine Lektion. #level-N (Level gibt es noch nicht)
// wird zu #level, Unbekanntes zum Start; beides ersetzt den Eintrag im Verlauf (`replace`), statt einen neuen anzulegen.

export type Screen = 'start' | 'level' | 'einstellungen' | 'lektion';

export interface Route {
  readonly screen: Screen;
  /** Nummer der Lektion, nur bei `lektion` */
  readonly n: number | null;
  /** Titel des Tabs */
  readonly title: string;
  /** Hash, auf den die Adresse ohne neuen Verlaufseintrag umgeschrieben wird ('' = ohne Hash); null = bleibt */
  readonly replace: string | null;
}

const NAME = 'Kistenschieber';
const titled = (t: string) => `${t} · ${NAME}`;

const start = (replace: string | null): Route => ({ screen: 'start', n: null, title: NAME, replace });

/** Wohin ein Hash (mit oder ohne #) führt, bei `count` Lektionen */
export function route(hash: string, count: number): Route {
  const h = hash.replace(/^#/, '');
  if (h === '' || h === 'start' || h === 'spiel') return start(null);
  if (h === 'level') return { screen: 'level', n: null, title: titled('Level wählen'), replace: null };
  if (h === 'einstellungen') return { screen: 'einstellungen', n: null, title: titled('Einstellungen'), replace: null };
  if (/^level-\d+$/.test(h)) return { screen: 'level', n: null, title: titled('Level wählen'), replace: '#level' };
  const m = /^lektion-([1-9]\d*)$/.exec(h);
  const n = m ? Number(m[1]) : 0;
  if (n >= 1 && n <= count) return { screen: 'lektion', n, title: titled(`Lektion ${n}`), replace: null };
  return start('');
}

/** Ziel des Knopfs „Weiterspielen“ und „Zurück zum Spiel“ */
export const lessonHash = (n: number): string => `#lektion-${n}`;
