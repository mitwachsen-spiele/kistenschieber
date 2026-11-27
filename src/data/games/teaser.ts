// Ausblick in der Levelwahl: Nach der Einführung kommen die Level in Kapiteln zu je zwölf. Nur die beiden Kapitel, die im
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

/** Überschrift und Pille des Ausblicks */
export const TEASER = { title: 'Level', pill: 'kommen bald' } as const;

export const chapterName = (c: Chapter): string => `Kapitel ${c.n}: ${c.title}`;

export const chapterRange = (c: Chapter): string => `Level ${c.from} bis ${c.to}, ${c.boxes}`;
