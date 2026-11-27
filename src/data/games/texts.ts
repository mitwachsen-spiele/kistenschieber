// Texte des Spielbildschirms wörtlich aus dem Entwurf „Kistenschieber“: Schild, Zähler, Titel und Knöpfe nach dem Sieg.
// Der Spielzustand (lib/games/sokoban/state.ts) meldet nur Schlüssel, hier stehen die Sätze dazu.
import type { CardState } from '../../lib/games/sokoban/progress';
import type { MsgKey } from '../../lib/games/sokoban/state';
import { LESSONS, type Lesson } from './lessons';

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

/** Text des Schilds für eine Meldung in einer Lektion bei moves Zügen; ohne Meldung leer */
export function signText(key: MsgKey | null, lesson: Pick<Lesson, 'n' | 'moves'>, moves: number): string {
  if (key === null) return '';
  if (key === 'win') return winText(moves, lesson.moves, isFinale(lesson.n));
  return SIGN[key];
}

/** Zähler oben rechts */
export const countText = (moves: number): string => (moves === 1 ? '1 Zug' : `${moves} Züge`);

/** Name einer Lektion, auch Titel im Spiel */
export const lessonName = (lesson: Pick<Lesson, 'n' | 'title'>): string => `Lektion ${lesson.n}: ${lesson.title}`;

/** Beschriftung des Spielfelds */
export const fieldLabel = (lesson: Pick<Lesson, 'n' | 'title'>): string =>
  `${lessonName(lesson)}. Antippen, Wischen oder Pfeiltasten bewegen die Figur.`;

/** Großer Knopf nach dem Sieg: weiter zur nächsten Lektion, nach der letzten zur Levelwahl (Level kommen später) */
export const nextText = (n: number): string => (isFinale(n) ? 'Zur Levelwahl' : `Weiter zu Lektion ${n + 1}`);

/** Feste Knöpfe des Spielbildschirms */
export const GAME_BUTTONS = {
  menu: 'Menü',
  again: 'Nochmal',
  offer: 'Zu knifflig? Überspringen',
  undo: 'Zug zurück',
} as const;

/** Menü im Spiel (Dialog): Einträge in der Reihenfolge des Entwurfs und die Notiz darunter */
export const MENU = {
  resume: 'Weiterspielen',
  restart: 'Neu starten',
  tip: 'Tipp',
  solution: 'Lösung zeigen',
  skip: 'Lektion überspringen',
  level: 'Level wählen',
  settings: 'Einstellungen',
  start: 'Startbildschirm',
  note: 'Überspringen und „Lösung zeigen“ machen die nächste Lektion frei. Zurückkommen geht jederzeit über „Level wählen“.',
} as const;

/** Steuerkreuz: Name der Gruppe und der vier Knöpfe */
export const PAD = { group: 'Laufen', up: 'Hoch', left: 'Links', right: 'Rechts', down: 'Runter' } as const;

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

/** Pille neben „Einführung“ in der Levelwahl */
export const introPill = (count: number, settled: boolean): string =>
  settled ? 'abgeschlossen' : `${count} Lektionen`;

/** Vorschaubild einer Lektionskarte */
export const thumbLabel = (n: number): string => `Vorschau von Lektion ${n}`;

/** Zeile unten auf einer Lektionskarte; eine offene freie Lektion hat keine */
export function badgeText(state: CardState, best: { readonly moves: number } | null): string | null {
  if (state === 'locked') return 'Noch zu';
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

/** Warum eine Lektion noch zu ist: erst die erste offene schaffen oder überspringen */
export const lockedWhy = (first: Pick<Lesson, 'n' | 'title'>): string =>
  `Schaff zuerst ${lessonName(first)} oder überspring es; dann geht es weiter.`;

/** Knopf zur ersten offenen Lektion */
export const lockedGo = (n: number): string => `Zu Lektion ${n}`;
