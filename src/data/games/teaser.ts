// Kapitel der Level und Ausblick auf die, die noch fehlen: Nach der Einführung kommen die Level in Kapiteln zu je zwölf.
// Nur die beiden Kapitel, die im Entwurf „Kistenschieber“ fertig sind, wörtlich von dort; die Kapitel 3 bis 9 sind dort
// nur geplant und erscheinen nicht. Spielbar sind die ersten `count` Level (levels.ts); was danach kommt, ist nur
// Ankündigung ohne Links.

export interface Chapter {
  readonly n: number;
  readonly title: string;
  /** erstes und letztes Level */
  readonly from: number;
  readonly to: number;
  readonly boxes: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { n: 1, title: 'Am Kai', from: 1, to: 12, boxes: '2 bis 3 Kisten' },
  { n: 2, title: 'Im Speicher', from: 13, to: 24, boxes: '3 bis 4 Kisten' },
];

/** Überschrift, Pille und Notiz des Ausblicks auf die Level, die noch fehlen (Levelwahl) */
export const TEASER = { title: 'Weitere Level', pill: 'kommen bald', note: 'Noch nicht spielbar.' } as const;

/** Zusatz zum Leittext der Levelwahl: Wie die Level aufgehen */
export const LEVEL_LEDE =
  'Die Level gehen wie ein Adventskalender auf: Level 1 am 1. Dezember, dann jeden Tag eins mehr.';

export const chapterName = (c: Chapter): string => `Kapitel ${c.n}: ${c.title}`;

export const chapterRange = (c: Chapter): string => `Level ${c.from} bis ${c.to}, ${c.boxes}`;

/** Der spielbare Teil der Kapitel bei `count` Leveln (nur Kapitel mit mindestens einem spielbaren Level) */
export const playable = (chapters: readonly Chapter[], count: number): Chapter[] =>
  chapters.filter((c) => c.from <= count).map((c) => ({ ...c, to: Math.min(c.to, count) }));

/** Was nach `count` Leveln noch kommt: Kapitel ab dem ersten fehlenden Level */
export const remaining = (chapters: readonly Chapter[], count: number): Chapter[] =>
  chapters.filter((c) => c.to > count).map((c) => ({ ...c, from: Math.max(c.from, count + 1) }));

/** Geschütztes Leerzeichen: Kapitelname und Spanne brechen nicht mitten durch */
const keep = (text: string): string => text.replaceAll(' ', ' ');

/** Kurzfassung für den Startbildschirm: die Kapitel und alle Level darin, jedes Stück ohne Umbruch in sich */
export function teaserLine(chapters: readonly Chapter[]): string {
  const first = chapters[0];
  const last = chapters.at(-1);
  if (!first || !last) return '';
  return `${chapters.map((c) => keep(chapterName(c))).join(' und ')}, ${keep(`Level ${first.from} bis ${last.to}`)}`;
}
