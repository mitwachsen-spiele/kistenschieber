import { describe, expect, it } from 'vitest';
import { lessonHash, nextHash, puzzleHash, route } from './ks-router';

const COUNTS = { e: 15, l: 6 };

describe('route', () => {
  it.each(['', '#', '#start', '#spiel', 'start'])('„%s“ zeigt den Start, die Adresse bleibt', (hash) => {
    expect(route(hash, COUNTS)).toEqual({
      screen: 'start',
      pack: null,
      n: null,
      title: 'Kistenschieber',
      replace: null,
    });
  });

  it('#level und #einstellungen mit Titel „X · Kistenschieber“', () => {
    expect(route('#level', COUNTS)).toEqual({
      screen: 'level',
      pack: null,
      n: null,
      title: 'Level wählen · Kistenschieber',
      replace: null,
    });
    expect(route('#einstellungen', COUNTS)).toMatchObject({
      screen: 'einstellungen',
      title: 'Einstellungen · Kistenschieber',
      replace: null,
    });
  });

  it('#lektion-1 bis #lektion-15 öffnen die Lektion', () => {
    expect(route('#lektion-1', COUNTS)).toEqual({
      screen: 'puzzle',
      pack: 'e',
      n: 1,
      title: 'Lektion 1 · Kistenschieber',
      replace: null,
    });
    expect(route('#lektion-15', COUNTS)).toMatchObject({ pack: 'e', n: 15, title: 'Lektion 15 · Kistenschieber' });
  });

  it('#level-1 bis #level-6 öffnen das Level', () => {
    expect(route('#level-1', COUNTS)).toEqual({
      screen: 'puzzle',
      pack: 'l',
      n: 1,
      title: 'Level 1 · Kistenschieber',
      replace: null,
    });
    expect(route('#level-6', COUNTS)).toMatchObject({ pack: 'l', n: 6, title: 'Level 6 · Kistenschieber' });
  });

  it.each(['#level-7', '#level-24', '#level-100', '#level-0', '#level-01'])(
    '%s wird zu #level (das Level gibt es noch nicht)',
    (hash) => {
      expect(route(hash, COUNTS)).toEqual({
        screen: 'level',
        pack: null,
        n: null,
        title: 'Level wählen · Kistenschieber',
        replace: '#level',
      });
    },
  );

  it.each(['#lektion-0', '#lektion-16', '#lektion-01', '#lektion-', '#lektion-x', '#quatsch', '#inhalt', '#Level'])(
    'Unbekanntes „%s“ zeigt den Start und nimmt den Hash aus der Adresse',
    (hash) => {
      expect(route(hash, COUNTS)).toMatchObject({ screen: 'start', title: 'Kistenschieber', replace: '' });
    },
  );

  it('Ziel einer Lektion und eines Levels', () => {
    expect(lessonHash(2)).toBe('#lektion-2');
    expect(puzzleHash('e', 3)).toBe('#lektion-3');
    expect(puzzleHash('l', 3)).toBe('#level-3');
  });
});

describe('nextHash', () => {
  const upTo = (k: number) => (n: number) => n <= k;

  it('nach einer Lektion die nächste', () => {
    expect(nextHash('e', 1, COUNTS, upTo(0))).toBe('#lektion-2');
    expect(nextHash('e', 14, COUNTS, upTo(0))).toBe('#lektion-15');
  });

  it('nach Lektion 15 Level 1, wenn es aufgegangen ist, sonst die Levelwahl', () => {
    expect(nextHash('e', 15, COUNTS, upTo(1))).toBe('#level-1');
    expect(nextHash('e', 15, COUNTS, upTo(0))).toBe('#level');
  });

  it('nach einem Level das nächste, wenn sein Tag gekommen ist; nach dem letzten die Levelwahl', () => {
    expect(nextHash('l', 1, COUNTS, upTo(2))).toBe('#level-2');
    expect(nextHash('l', 2, COUNTS, upTo(2))).toBe('#level');
    expect(nextHash('l', 6, COUNTS, upTo(99))).toBe('#level');
  });
});
