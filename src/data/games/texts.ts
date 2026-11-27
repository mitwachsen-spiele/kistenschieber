// Texte des Spielbildschirms wörtlich aus dem Entwurf „Kistenschieber“: Schild, Zähler, Titel und Knöpfe nach dem Sieg.
// Der Spielzustand (lib/games/sokoban/state.ts) meldet nur Schlüssel, hier stehen die Sätze dazu.
import type { MsgKey } from '../../lib/games/sokoban/state';
import { LESSONS, type Lesson } from './lessons';

/** Schild-Texte ohne Intro (steht je Lektion) und ohne Sieg (mit Zahlen, siehe winText) */
export const SIGN = {
  blocked: 'Dahinter ist kein Platz für die Kiste.',
  stuck: 'Diese Kiste kommt hier nicht mehr weg. Mit „Zug zurück“ geht es weiter.',
  unsolvable: 'So geht es nicht mehr auf. Mit „Zug zurück“ ein paar Schritte zurück.',
  placed: 'Die Kiste steht.',
  atStart: 'Ganz am Anfang, weiter zurück geht es nicht.',
  restarted: 'Neu gestartet. Mit „Zug zurück“ kommst du zum alten Stand.',
  tipDead: 'Von hier aus geht es nicht mehr. Nimm mit „Zug zurück“ ein paar Schritte zurück.',
  tipHard: 'Das ist zu verzwickt für einen schnellen Tipp.',
  tip: 'Tipp: Diese Kiste in Richtung des türkisen Pfeils schieben. Tipp auf den Pfeil, dann läuft die Figur hin.',
  noOptions: 'Diese Kiste lässt sich gerade nirgendwohin schieben.',
  showing: 'So geht es: Schau zu. Wenn du selbst weitermachen willst, tipp aufs Feld oder drück eine Taste.',
  shownWin: 'So geht es. Jetzt du? „Nochmal“ startet die Lektion neu.',
} as const satisfies Record<Exclude<MsgKey, 'intro' | 'win'>, string>;

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

/** Text des Schilds für eine Meldung in einer Lektion bei moves Zügen */
export function signText(key: MsgKey, lesson: Pick<Lesson, 'n' | 'intro' | 'moves'>, moves: number): string {
  if (key === 'intro') return lesson.intro;
  if (key === 'win') return winText(moves, lesson.moves, isFinale(lesson.n));
  return SIGN[key];
}

/** Zähler oben rechts */
export const countText = (moves: number): string => (moves === 1 ? '1 Zug' : `${moves} Züge`);

/** Name einer Lektion, auch Titel im Spiel */
export const lessonName = (lesson: Pick<Lesson, 'n' | 'title'>): string => `Lektion ${lesson.n}: ${lesson.title}`;

/** Großer Knopf nach dem Sieg: weiter zur nächsten Lektion, nach der letzten zur Levelwahl (Level kommen später) */
export const nextText = (n: number): string => (isFinale(n) ? 'Zur Levelwahl' : `Weiter zu Lektion ${n + 1}`);

/** Feste Knöpfe des Spielbildschirms */
export const GAME_BUTTONS = {
  menu: 'Menü',
  again: 'Nochmal',
  offer: 'Zu knifflig? Überspringen',
  undo: 'Zug zurück',
  tip: 'Tipp',
} as const;

/** Zeile unter dem Titel des Startbildschirms; nach der Einführung kommen die Level erst noch */
export const startStatus = (done: number, count: number, introDone: boolean): string =>
  introDone ? 'Einführung geschafft. Die Level kommen bald.' : `Einführung: ${done} von ${count} Lektionen geschafft`;

/** Großer Knopf des Startbildschirms */
export const continueText = (started: boolean, n: number): string =>
  started ? `Weiterspielen: Lektion ${n}` : 'Spielen';

/** Bild einer Lektion auf dem Startbildschirm */
export const sceneLabel = (lesson: Pick<Lesson, 'n' | 'title'>): string => `${lessonName(lesson)} als Bild`;

/** Unterzeile einer Lektionskarte */
export const cardTag = (boxes: number, moves: number): string =>
  `${boxes === 1 ? '1 Kiste' : `${boxes} Kisten`}, kürzester Weg ${moves} Züge`;
