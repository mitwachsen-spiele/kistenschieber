import { describe, expect, it } from 'vitest';
import { CHAPTERS, TEASER, chapterName, chapterRange } from './teaser';

describe('Ausblick auf die Level', () => {
  it('nur die Kapitel 1 und 2, wörtlich aus dem Entwurf', () => {
    expect(CHAPTERS.map(chapterName)).toEqual(['Kapitel 1: Am Kai', 'Kapitel 2: Im Speicher']);
    expect(CHAPTERS.map(chapterRange)).toEqual(['Level 1 bis 12, 2 bis 3 Kisten', 'Level 13 bis 24, 3 bis 4 Kisten']);
  });

  it('die Kapitel schließen lückenlos an, je zwölf Level, zusammen 24', () => {
    let next = 1;
    for (const c of CHAPTERS) {
      expect(c.from).toBe(next);
      expect(c.to - c.from + 1).toBe(12);
      next = c.to + 1;
    }
    expect(next - 1).toBe(24);
  });

  it('Überschrift „Level“ mit „kommen bald“', () => {
    expect(TEASER).toEqual({ title: 'Level', pill: 'kommen bald' });
  });
});
