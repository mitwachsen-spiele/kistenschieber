// Ausblick auf Startbildschirm und Levelwahl: Nach der Einführung kommen die Level in Kapiteln zu je zwölf. Nur die beiden Kapitel, die im
// Entwurf „Kistenschieber“ fertig sind, wörtlich von dort; die Kapitel 3 bis 9 sind dort nur geplant und erscheinen nicht.
// Reine Anzeige: Level gibt es noch nicht, darum keine Links.

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

/** Überschrift, Pille und Notiz des Ausblicks (Startbildschirm und Levelwahl) */
export const TEASER = { title: 'Level', pill: 'kommen bald', note: 'Noch nicht spielbar.' } as const;

/** Zusatz zum Leittext der Levelwahl, damit schon oben steht, was spielbar ist */
export const LEVEL_LEDE = 'Spielbar ist bisher nur die Einführung, die Level kommen bald.';

export const chapterName = (c: Chapter): string => `Kapitel ${c.n}: ${c.title}`;

export const chapterRange = (c: Chapter): string => `Level ${c.from} bis ${c.to}, ${c.boxes}`;

/** Geschütztes Leerzeichen: Kapitelname und Spanne brechen nicht mitten durch */
const keep = (text: string): string => text.replaceAll(' ', '\u00a0');

/** Kurzfassung für den Startbildschirm: die Kapitel und alle Level darin, jedes Stück ohne Umbruch in sich */
export function teaserLine(chapters: readonly Chapter[]): string {
  const first = chapters[0];
  const last = chapters.at(-1);
  if (!first || !last) return '';
  return `${chapters.map((c) => keep(chapterName(c))).join(' und ')}, ${keep(`Level ${first.from} bis ${last.to}`)}`;
}
