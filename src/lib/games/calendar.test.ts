import { describe, expect, it } from 'vitest';
import { dayStart } from './calendar';

describe('dayStart', () => {
  it('Berlin im Winter: 0 Uhr ist 23 Uhr UTC am Vortag', () => {
    expect(dayStart('2026-12-01', 'Europe/Berlin')).toBe(Date.UTC(2026, 10, 30, 23));
    expect(dayStart('2026-12-24', 'Europe/Berlin')).toBe(Date.UTC(2026, 11, 23, 23));
  });

  it('Berlin im Sommer: 0 Uhr ist 22 Uhr UTC am Vortag', () => {
    expect(dayStart('2026-07-01', 'Europe/Berlin')).toBe(Date.UTC(2026, 5, 30, 22));
  });

  it('Tage der Zeitumstellung beginnen noch in der alten Zeit', () => {
    expect(dayStart('2026-03-29', 'Europe/Berlin')).toBe(Date.UTC(2026, 2, 28, 23));
    expect(dayStart('2026-10-25', 'Europe/Berlin')).toBe(Date.UTC(2026, 9, 24, 22));
  });

  it('andere Zonen: UTC und westlich von Greenwich', () => {
    expect(dayStart('2026-12-01', 'UTC')).toBe(Date.UTC(2026, 11, 1));
    expect(dayStart('2026-12-01', 'America/New_York')).toBe(Date.UTC(2026, 11, 1, 5));
  });

  it('verlangt ein Datum der Form JJJJ-MM-TT', () => {
    expect(() => dayStart('1.12.2026', 'Europe/Berlin')).toThrow('Kein Datum');
  });
});
