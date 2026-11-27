import { describe, expect, it } from 'vitest';
import { CHAPTERS, LEVEL_LEDE, TEASER, chapterName, chapterRange, teaserLine } from './teaser';

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

  it('Überschrift „Level“ mit „kommen bald“ und der Notiz, dass sie noch nicht spielbar sind', () => {
    expect(TEASER).toEqual({ title: 'Level', pill: 'kommen bald', note: 'Noch nicht spielbar.' });
    expect(LEVEL_LEDE).toBe('Spielbar ist bisher nur die Einführung, die Level kommen bald.');
  });

  it('Kurzfassung für den Startbildschirm: Kapitel und Spanne aller Level; ohne Kapitel leer', () => {
    const plain = (s: string) => s.replaceAll('\u00a0', ' ');
    expect(plain(teaserLine(CHAPTERS))).toBe('Kapitel 1: Am Kai und Kapitel 2: Im Speicher, Level 1 bis 24');
    expect(plain(teaserLine(CHAPTERS.slice(0, 1)))).toBe('Kapitel 1: Am Kai, Level 1 bis 12');
    // Umbrechen nur zwischen den Stücken
    expect(teaserLine(CHAPTERS).split(/ /)).toEqual([
      'Kapitel\u00a01:\u00a0Am\u00a0Kai',
      'und',
      'Kapitel\u00a02:\u00a0Im\u00a0Speicher,',
      'Level\u00a01\u00a0bis\u00a024',
    ]);
    expect(teaserLine([])).toBe('');
  });
});
