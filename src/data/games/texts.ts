// Texte des Spielbildschirms wörtlich aus dem Entwurf „Kistenschieber“: Schild, Zähler, Titel und Knöpfe nach dem Sieg.
// Der Spielzustand (lib/games/sokoban/state.ts) meldet nur Schlüssel, hier stehen die Sätze dazu. Lektionen (Paket e)
// und Level (l) teilen sich die Sätze; wo sie sich unterscheiden, nimmt die Funktion das Paket. Die Texte zum
// Adventskalender der Level gibt es im Entwurf nicht (siehe Spec, „Bewusst anders als im Entwurf“).
import type { CardState } from '../../lib/games/sokoban/progress';
import type { MsgKey } from '../../lib/games/sokoban/state';
import { LESSONS, type Lesson } from './lessons';
import { type Pack, WORD } from './packs';

/** Was ein Text von einer Lektion oder einem Level braucht */
type Named = Pick<Lesson, 'n' | 'title'>;

/** Schild-Texte ohne Sieg (mit Zahlen, siehe winText); ohne Meldung bleibt das Schild leer */
export const SIGN = {
  blocked: 'Dahinter ist kein Platz für die Kiste.',
  stuck: 'Diese Kiste kommt hier nicht mehr weg. Mit „Zug zurück“ geht es weiter.',
  unsolvable: 'So geht es nicht mehr auf. Mit „Zug zurück“ ein paar Schritte zurück.',
  atStart: 'Ganz am Anfang, weiter zurück geht es nicht.',
  restarted: 'Neu gestartet. Mit „Zug zurück“ kommst du zum alten Stand.',
  tipDead: 'Von hier aus geht es nicht mehr. Nimm mit „Zug zurück“ ein paar Schritte zurück.',
  tipHard: 'Das ist zu verzwickt für einen schnellen Tipp.',
  tip: 'Tipp: Diese Kiste in Pfeilrichtung schieben.',
  noOptions: 'Diese Kiste lässt sich gerade nirgendwohin schieben.',
  showing: 'So geht es: Schau zu. Wenn du selbst weitermachen willst, tipp aufs Feld oder drück eine Taste.',
  shownWin: 'So geht es. Jetzt du? „Nochmal“ startet die Lektion neu.',
} as const satisfies Record<Exclude<MsgKey, 'win'>, string>;

/** Nach vorgespielter Lösung in einem Level (Entwurf: „die Lektion“ bzw. „das Level“) */
export const SHOWN_WIN_LEVEL = 'So geht es. Jetzt du? „Nochmal“ startet das Level neu.';

/** Zusatz nach dem Sieg in der letzten Lektion */
export const FINALE = ' Damit ist die Einführung geschafft.';

/** Ist n die letzte Lektion der Einführung? */
export const isFinale = (n: number): boolean => n === LESSONS.length;

/** Sieg-Text: kürzer geht es nicht (bis zum Optimum) oder das Optimum dazu; nach der letzten Lektion der Zusatz */
export function winText(moves: number, optimum: number, finale: boolean): string {
  const head =
    moves <= optimum
      ? `Geschafft! ${moves} Züge, kürzer geht es nicht.`
      : `Geschafft! ${moves} Züge, am kürzesten wären ${optimum}.`;
  return head + (finale ? FINALE : '');
}

/** Text des Schilds für eine Meldung in einer Lektion (oder einem Level) bei moves Zügen; ohne Meldung leer */
export function signText(
  key: MsgKey | null,
  lesson: Pick<Lesson, 'n' | 'moves'>,
  moves: number,
  pack: Pack = 'e',
): string {
  if (key === null) return '';
  if (key === 'win') return winText(moves, lesson.moves, pack === 'e' && isFinale(lesson.n));
  if (key === 'shownWin' && pack === 'l') return SHOWN_WIN_LEVEL;
  return SIGN[key];
}

/** Zähler oben rechts */
export const countText = (moves: number): string => (moves === 1 ? '1 Zug' : `${moves} Züge`);

/** Name einer Lektion oder eines Levels, auch Titel im Spiel: „Lektion 3: Zwei Kisten“, „Level 2: Poller“ */
export const puzzleName = (pack: Pack, p: Named): string => `${WORD[pack]} ${p.n}: ${p.title}`;

/** Name einer Lektion */
export const lessonName = (lesson: Named): string => puzzleName('e', lesson);

/** Beschriftung des Spielfelds */
export const fieldLabel = (p: Named, pack: Pack = 'e'): string =>
  `${puzzleName(pack, p)}. Antippen oder Pfeiltasten bewegen die Figur.`;

/** Großer Knopf nach dem Sieg, aus seinem Ziel (ks-router.ts, nextHash): weiter zur nächsten, sonst zur Levelwahl */
export function nextText(hash: string): string {
  const m = /^#(lektion|level)-(\d+)$/.exec(hash);
  return m ? `Weiter zu ${m[1] === 'level' ? WORD.l : WORD.e} ${m[2]}` : 'Zur Levelwahl';
}

/** Feste Knöpfe des Spielbildschirms */
export const GAME_BUTTONS = {
  menu: 'Menü',
  again: 'Nochmal',
  offer: 'Zu knifflig? Überspringen',
  undo: 'Zug zurück',
} as const;

/** Menü im Spiel (Dialog): Einträge in der Reihenfolge des Entwurfs; „überspringen“ und die Notiz je Paket */
export const MENU = {
  resume: 'Weiterspielen',
  restart: 'Neu starten',
  tip: 'Tipp',
  solution: 'Lösung zeigen',
  level: 'Level wählen',
  settings: 'Einstellungen',
  start: 'Startbildschirm',
} as const;

/** Menü: „Lektion überspringen“ bzw. „Level überspringen“ */
export const menuSkip = (pack: Pack): string => `${WORD[pack]} überspringen`;

/** Notiz unter dem Menü, wörtlich aus dem Entwurf */
export const menuNote = (pack: Pack): string =>
  `Überspringen und „Lösung zeigen“ machen ${pack === 'e' ? 'die nächste Lektion' : 'das nächste Level'} frei. Zurückkommen geht jederzeit über „${MENU.level}“.`;

/** Steuerkreuz: Name der Gruppe und der vier Knöpfe */
export const PAD = { group: 'Laufen', up: 'Hoch', left: 'Links', right: 'Rechts', down: 'Runter' } as const;

/**
 * Startbildschirm, Teil „Einführung“: spielbar, mit Fortschritt; geschafft (introComplete) mit Haken. Der zweite Teil,
 * die Level, steht in teaser.ts und ist nur Ankündigung
 */
export const INTRO = { title: 'Einführung', now: 'jetzt spielbar', done: '✓ geschafft' } as const;

/** Unterzeile der Einführung */
export const introSub = (count: number): string => `Lernen in ${count} Lektionen`;

/** Pille neben „Einführung“ auf dem Startbildschirm */
export const startPill = (complete: boolean): string => (complete ? INTRO.done : INTRO.now);

/**
 * Fortschritt der Einführung auf dem Startbildschirm; geschafft zählt „mit Lösung gesehen“ mit. Übersprungene, die noch
 * fehlen, werden genannt: Sie stehen dem Haken im Weg
 */
export function startStatus(done: number, count: number, complete: boolean, skipped = 0): string {
  if (complete) return `Alle ${count} Lektionen erledigt.`;
  const line = `${done} von ${count} Lektionen geschafft`;
  return skipped > 0 ? `${line}, ${skipped} übersprungen` : line;
}

/** Großer Knopf des Startbildschirms; `repeat` (startPoint): die geschaffte Einführung von vorn */
export const continueText = (started: boolean, n: number, repeat = false): string =>
  repeat ? 'Einführung wiederholen' : started ? `Weiterspielen: Lektion ${n}` : 'Spielen';

/** Bild einer Lektion auf dem Startbildschirm */
export const sceneLabel = (lesson: Pick<Lesson, 'n' | 'title'>): string => `${lessonName(lesson)} als Bild`;

/** Unterzeile einer Lektionskarte */
export const cardTag = (boxes: number, moves: number): string =>
  `${boxes === 1 ? '1 Kiste' : `${boxes} Kisten`}, kürzester Weg ${moves} Züge`;

/** Pille neben „Einführung“ in der Levelwahl: derselbe Haken wie auf dem Startbildschirm */
export const introPill = (count: number, complete: boolean): string => (complete ? INTRO.done : `${count} Lektionen`);

/** Vorschaubild einer Lektions- oder Levelkarte */
export const thumbLabel = (n: number, pack: Pack = 'e'): string => `Vorschau von ${WORD[pack]} ${n}`;

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

/** Tag aus JJJJ-MM-TT: „3. Dezember“ */
export function dayText(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d}. ${MONTHS[(m ?? 1) - 1] ?? ''}`;
}

/**
 * Zeile unten auf einer Karte; eine offene freie hat keine. Ein Level, dessen Tag noch nicht gekommen ist (`opens`),
 * sagt, wann es aufgeht
 */
export function badgeText(
  state: CardState,
  best: { readonly moves: number } | null,
  opens: string | null = null,
): string | null {
  if (state === 'locked') return opens ? `Geht am ${dayText(opens)} auf` : 'Noch zu';
  if (state === 'done') return best ? `Geschafft, Bestwert ${best.moves} Züge` : null;
  if (state === 'shown') return 'Mit Lösung gesehen';
  return state === 'skipped' ? 'Übersprungen, später nachholen' : null;
}

/** Seite einer gesperrten Lektion: Überschrift, warum, wohin, Hinweis */
export const LOCKED = {
  title: 'Diese Lektion ist noch zu',
  state: 'noch zu',
  note: 'Alles wird der Reihe nach frei.',
} as const;

/** Dasselbe für ein Level (Überschrift wie im Entwurf); der Hinweis nennt den Adventskalender */
export const LOCKED_LEVEL = {
  title: 'Dieses Level ist noch zu',
  note: 'Jeden Tag im Advent geht ein neues Level auf. Gespielt wird der Reihe nach.',
} as const;

/** Warum eine Lektion (ein Level) noch zu ist: erst die erste offene schaffen oder überspringen */
export const lockedWhy = (first: Named, pack: Pack = 'e'): string =>
  `Schaff zuerst ${puzzleName(pack, first)} oder überspring es; dann geht es weiter.`;

/** Warum ein Level noch zu ist: sein Tag ist noch nicht gekommen */
export const lockedDay = (level: Named, opens: string): string =>
  `${puzzleName('l', level)} geht am ${dayText(opens)} auf.`;

/** Knopf zur ersten offenen Lektion (zum ersten offenen Level) */
export const lockedGo = (n: number, pack: Pack = 'e'): string => `Zu ${WORD[pack]} ${n}`;

/** Startbildschirm, Teil „Level“: Überschrift und Pille vor und ab dem ersten Tag des Adventskalenders */
export const LEVEL_PART = { title: 'Level', soon: 'ab 1. Dezember', now: 'Adventskalender' } as const;

/**
 * Stand der Level auf dem Startbildschirm: vor dem ersten Tag, wann es losgeht; danach geschafft von aufgegangen, und
 * wann das nächste aufgeht (`next`: Nummer und Tag), sonst dass weitere folgen
 */
export function levelStatus(
  done: number,
  open: number,
  span: { readonly first: string; readonly last: string },
  next: { readonly n: number; readonly opens: string } | null,
): string {
  if (open === 0) return `Vom ${dayText(span.first)} bis ${dayText(span.last)} geht jeden Tag ein neues Level auf.`;
  const line = `${done} von ${open} ${open === 1 ? 'Level' : 'Leveln'} geschafft.`;
  // „Level 4“ und „4. Dezember“ brechen nicht mitten durch
  const keep = (t: string) => t.replaceAll(' ', '\u00a0');
  return `${line} ${next ? `${keep(`Level ${next.n}`)} geht am ${keep(dayText(next.opens))} auf.` : 'Weitere Level folgen.'}`;
}

/** Knopf der Level auf dem Startbildschirm */
export const levelGo = (started: boolean, n: number): string =>
  started ? `Weiterspielen: Level ${n}` : `Level ${n} spielen`;
