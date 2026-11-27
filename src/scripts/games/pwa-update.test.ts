import { describe, expect, it } from 'vitest';
import {
  APPLY_GAP,
  ARM_MS,
  LONG_PAUSE,
  WIN_MS,
  longPause,
  registrationOptions,
  safeMoment,
  shouldApply,
  shouldReload,
  type Chance,
  type Moment,
  type Takeover,
} from './pwa-update';
import { CONFETTI_LIFE } from '../../lib/games/sokoban/confetti';

const onStart: Moment = { screen: 'start', won: false, menuOpen: false, persistent: true, visible: true };

describe('App-Update: sicherer Moment', () => {
  it('Startbildschirm, Levelwahl, gesperrte Lektion und Einstellungen sind sicher', () => {
    for (const screen of ['start', 'level', 'gesperrt', 'einstellungen'] as const)
      expect(safeMoment({ ...onStart, screen })).toBe(true);
  });

  it('im Spiel nur nach „Geschafft!“, mitten in einer Lektion nie', () => {
    expect(safeMoment({ ...onStart, screen: 'spiel', won: true })).toBe(true);
    expect(safeMoment({ ...onStart, screen: 'spiel' })).toBe(false);
  });

  it('nie bei offenem Menü, ohne dauerhaften Speicher oder bei verborgener Seite', () => {
    expect(safeMoment({ ...onStart, screen: 'spiel', won: true, menuOpen: true })).toBe(false);
    expect(safeMoment({ ...onStart, persistent: false })).toBe(false);
    expect(safeMoment({ ...onStart, visible: false })).toBe(false);
  });

  it('nach „Geschafft!“ erst, wenn das Konfetti verflogen ist', () => {
    expect(WIN_MS).toBeGreaterThan(CONFETTI_LIFE);
  });
});

describe('App-Update: lange Pause', () => {
  it('zählt erst ab der Schwelle und nur, wenn die Seite verborgen war', () => {
    const t = 1_000_000_000;
    expect(longPause(t, t + LONG_PAUSE)).toBe(true);
    expect(longPause(t, t + LONG_PAUSE - 1)).toBe(false);
    expect(longPause(0, t)).toBe(false);
  });
});

describe('App-Update: übernehmen', () => {
  const now = 2_000_000_000;
  const chance: Chance = { waiting: true, armedAt: now - 1000, lastApplied: 0, now, safe: true };

  it('übernimmt eine wartende Version kurz nach einem Auslöser im sicheren Moment', () => {
    expect(shouldApply(chance)).toBe(true);
    expect(shouldApply({ ...chance, armedAt: now - ARM_MS })).toBe(true);
  });

  it('nicht ohne wartende Version, ohne sicheren Moment oder ohne Auslöser', () => {
    expect(shouldApply({ ...chance, waiting: false })).toBe(false);
    expect(shouldApply({ ...chance, safe: false })).toBe(false);
    expect(shouldApply({ ...chance, armedAt: 0 })).toBe(false);
  });

  it('nicht lange nach dem Auslöser (eine Version, die erst mitten in der nächsten Lektion fertig wird)', () => {
    expect(shouldApply({ ...chance, armedAt: now - ARM_MS - 1 })).toBe(false);
    expect(shouldApply({ ...chance, armedAt: now + 1 })).toBe(false);
  });

  it('lädt nicht in einer Schleife neu', () => {
    expect(shouldApply({ ...chance, lastApplied: now - 5000 })).toBe(false);
    expect(shouldApply({ ...chance, lastApplied: now - APPLY_GAP })).toBe(true);
    expect(shouldApply({ ...chance, lastApplied: now + 5000 })).toBe(true); // Uhr zurückgestellt
  });
});

describe('App-Update: neu laden nach der Übernahme', () => {
  const now = 2_000_000_000;
  const takeover: Takeover = { taken: true, safe: true, armedAt: now - 1000, now };

  it('lädt neu, wenn die neue Version übernommen hat und der Moment noch sicher ist', () => {
    expect(shouldReload(takeover)).toBe(true);
    expect(shouldReload({ ...takeover, armedAt: now - ARM_MS })).toBe(true);
  });

  it('nicht, wenn das Kind zwischen Bitte und Übernahme eine Lektion geöffnet hat – dann beim nächsten Auslöser', () => {
    expect(shouldReload({ ...takeover, safe: false })).toBe(false);
    // Später: wieder auf dem Startbildschirm, neuer Auslöser
    expect(shouldReload({ ...takeover, armedAt: now + 600_000, now: now + 601_000 })).toBe(true);
  });

  it('nie ohne eigene Bitte, ohne Auslöser oder lange danach', () => {
    expect(shouldReload({ ...takeover, taken: false })).toBe(false);
    expect(shouldReload({ ...takeover, armedAt: 0 })).toBe(false);
    expect(shouldReload({ ...takeover, armedAt: now - ARM_MS - 1 })).toBe(false);
    expect(shouldReload({ ...takeover, armedAt: now + 1 })).toBe(false);
  });
});

describe('Anmeldung', () => {
  it('fragt am HTTP-Cache vorbei nach einer neuen Version, nie über den Cache', () => {
    const opts = registrationOptions('/');
    expect(opts).toEqual({ scope: '/', updateViaCache: 'none' });
    expect(opts.updateViaCache).not.toBe('all');
  });
});
