import { describe, expect, it } from 'vitest';
import { lessonHash, nextHash, route } from './ks-router';

const COUNT = 15;

describe('route', () => {
  it.each(['', '#', '#start', '#spiel', 'start'])('„%s“ zeigt den Start, die Adresse bleibt', (hash) => {
    expect(route(hash, COUNT)).toEqual({ screen: 'start', n: null, title: 'Kistenschieber', replace: null });
  });

  it('#level und #einstellungen mit Titel „X · Kistenschieber“', () => {
    expect(route('#level', COUNT)).toEqual({
      screen: 'level',
      n: null,
      title: 'Level wählen · Kistenschieber',
      replace: null,
    });
    expect(route('#einstellungen', COUNT)).toEqual({
      screen: 'einstellungen',
      n: null,
      title: 'Einstellungen · Kistenschieber',
      replace: null,
    });
  });

  it('#lektion-1 bis #lektion-15 öffnen die Lektion', () => {
    expect(route('#lektion-1', COUNT)).toEqual({
      screen: 'lektion',
      n: 1,
      title: 'Lektion 1 · Kistenschieber',
      replace: null,
    });
    expect(route('#lektion-15', COUNT)).toMatchObject({
      screen: 'lektion',
      n: 15,
      title: 'Lektion 15 · Kistenschieber',
    });
  });

  it.each(['#level-1', '#level-3', '#level-24', '#level-100'])(
    '%s wird zu #level (Level gibt es noch nicht)',
    (hash) => {
      expect(route(hash, COUNT)).toEqual({
        screen: 'level',
        n: null,
        title: 'Level wählen · Kistenschieber',
        replace: '#level',
      });
    },
  );

  it.each(['#lektion-0', '#lektion-16', '#lektion-01', '#lektion-', '#lektion-x', '#quatsch', '#inhalt', '#Level'])(
    'Unbekanntes „%s“ zeigt den Start und nimmt den Hash aus der Adresse',
    (hash) => {
      expect(route(hash, COUNT)).toEqual({ screen: 'start', n: null, title: 'Kistenschieber', replace: '' });
    },
  );

  it('Ziel der Lektion', () => {
    expect(lessonHash(2)).toBe('#lektion-2');
  });

  it('nach dem Sieg zur nächsten Lektion, nach der letzten zur Levelwahl', () => {
    expect(nextHash(1, COUNT)).toBe('#lektion-2');
    expect(nextHash(14, COUNT)).toBe('#lektion-15');
    expect(nextHash(15, COUNT)).toBe('#level');
  });
});
