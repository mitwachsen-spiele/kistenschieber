import { describe, expect, it } from 'vitest';
import {
  type Best,
  type Flag,
  type ProgressKV,
  allSettled,
  cardState,
  doneCount,
  firstPlayable,
  introDone,
  lastRef,
  markOpened,
  markShown,
  markSkipped,
  recordWin,
  refOf,
  started,
  stateOf,
  unlocked,
} from './progress';

const COUNT = 15;

/** Fortschritt im Arbeitsspeicher */
function memoryKV(): ProgressKV & { readonly data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    best: (n) => (data.get(`best.e${n}`) as Best | undefined) ?? null,
    flag: (kind: Flag, n) => data.get(`${kind}.e${n}`) === true,
    last: () => (data.get('last') as string | undefined) ?? null,
    setBest: (n, best) => void data.set(`best.e${n}`, best),
    setFlag: (kind, n) => void data.set(`${kind}.e${n}`, true),
    setLast: (ref) => void data.set('last', ref),
  };
}

describe('stateOf', () => {
  it('geschafft vor gesehen vor übersprungen vor offen', () => {
    const kv = memoryKV();
    expect(stateOf(kv, 1)).toBe('open');
    kv.setFlag('skip', 1);
    expect(stateOf(kv, 1)).toBe('skipped');
    kv.setFlag('shown', 1);
    expect(stateOf(kv, 1)).toBe('shown');
    kv.setBest(1, { moves: 9, pushes: 4 });
    expect(stateOf(kv, 1)).toBe('done');
  });
});

describe('Freischalten der Reihe nach', () => {
  it('ohne Fortschritt ist nur Lektion 1 frei', () => {
    const kv = memoryKV();
    expect(unlocked(kv, 1)).toBe(true);
    for (let n = 2; n <= COUNT; n++) expect(unlocked(kv, n)).toBe(false);
  });

  it('geschafft, übersprungen und gesehen machen die nächste frei, aber nicht die übernächste', () => {
    const kv = memoryKV();
    kv.setBest(1, { moves: 9, pushes: 4 });
    expect([unlocked(kv, 2), unlocked(kv, 3)]).toEqual([true, false]);
    kv.setFlag('skip', 2);
    expect([unlocked(kv, 3), unlocked(kv, 4)]).toEqual([true, false]);
    kv.setFlag('shown', 3);
    expect([unlocked(kv, 4), unlocked(kv, 5)]).toEqual([true, false]);
  });
});

describe('Wo es weitergeht', () => {
  it('firstPlayable: erste freie offene Lektion, sind alle erledigt die letzte', () => {
    const kv = memoryKV();
    expect(firstPlayable(kv, COUNT)).toBe(1);
    kv.setBest(1, { moves: 9, pushes: 4 });
    kv.setFlag('skip', 2);
    expect(firstPlayable(kv, COUNT)).toBe(3);
    for (let n = 1; n <= COUNT; n++) kv.setFlag('shown', n);
    expect(firstPlayable(kv, COUNT)).toBe(COUNT);
  });

  it('lastRef nimmt die letzte Lektion, wenn sie gültig und frei ist', () => {
    const kv = memoryKV();
    kv.setBest(1, { moves: 9, pushes: 4 });
    kv.setBest(2, { moves: 6, pushes: 4 });
    kv.setLast(refOf(1));
    expect(lastRef(kv, COUNT)).toBe(1);
  });

  it.each([
    ['fehlt', null],
    ['ungültig', 'x3'],
    ['Level statt Lektion', 'l3'],
    ['zu groß', 'e16'],
    ['null', 'e0'],
    ['gesperrt', 'e9'],
  ])('lastRef fällt auf die erste freie offene Lektion zurück: last %s', (_, last) => {
    const kv = memoryKV();
    kv.setBest(1, { moves: 9, pushes: 4 });
    if (last !== null) kv.setLast(last);
    expect(lastRef(kv, COUNT)).toBe(2);
  });

  it('markOpened merkt nur freie Lektionen', () => {
    const kv = memoryKV();
    expect(markOpened(kv, 9)).toBe(false);
    expect(kv.last()).toBeNull();
    expect(markOpened(kv, 1)).toBe(true);
    expect(kv.last()).toBe('e1');
  });

  it('doneCount zählt nur Bestwerte', () => {
    const kv = memoryKV();
    kv.setBest(1, { moves: 9, pushes: 4 });
    kv.setFlag('skip', 2);
    kv.setFlag('shown', 3);
    expect(doneCount(kv, COUNT)).toBe(1);
  });
});

describe('Bestwert, Überspringen, Lösung gesehen', () => {
  it('recordWin: erster Sieg, weniger Züge, gleich viele Züge mit weniger Schüben', () => {
    const kv = memoryKV();
    expect(recordWin(kv, 1, { moves: 12, pushes: 5, shown: false })).toBe(true);
    expect(recordWin(kv, 1, { moves: 13, pushes: 4, shown: false })).toBe(false);
    expect(recordWin(kv, 1, { moves: 12, pushes: 5, shown: false })).toBe(false);
    expect(recordWin(kv, 1, { moves: 12, pushes: 4, shown: false })).toBe(true);
    expect(recordWin(kv, 1, { moves: 9, pushes: 4, shown: false })).toBe(true);
    expect(kv.best(1)).toEqual({ moves: 9, pushes: 4 });
  });

  it('recordWin: ein vorgespielter Sieg zählt nie', () => {
    const kv = memoryKV();
    expect(recordWin(kv, 1, { moves: 9, pushes: 4, shown: true })).toBe(false);
    expect(kv.best(1)).toBeNull();
    expect(kv.data.size).toBe(0);
  });

  it('Überspringen überschreibt keinen Bestwert', () => {
    const kv = memoryKV();
    kv.setBest(3, { moves: 20, pushes: 6 });
    expect(markSkipped(kv, 3)).toBe(false);
    expect(kv.flag('skip', 3)).toBe(false);
    expect(stateOf(kv, 3)).toBe('done');
    expect(markSkipped(kv, 4)).toBe(true);
    expect(stateOf(kv, 4)).toBe('skipped');
  });

  it('markShown merkt „mit Lösung gesehen“', () => {
    const kv = memoryKV();
    markShown(kv, 2);
    expect(stateOf(kv, 2)).toBe('shown');
    expect(unlocked(kv, 3)).toBe(true);
  });
});

describe('Startbildschirm', () => {
  it('started: ohne Fortschritt und ohne letzte Lektion (oder mit e1) noch nicht angefangen', () => {
    const kv = memoryKV();
    expect(started(kv, COUNT)).toBe(false);
    kv.setLast('e1');
    expect(started(kv, COUNT)).toBe(false);
  });

  it('started: eine erledigte Lektion oder eine spätere freie letzte Lektion heißt angefangen', () => {
    const skipped = memoryKV();
    skipped.setFlag('skip', 1);
    expect(started(skipped, COUNT)).toBe(true);
    const best = memoryKV();
    best.setBest(3, { moves: 14, pushes: 6 });
    expect(started(best, COUNT)).toBe(true);
  });

  it('started: eine gesperrte letzte Lektion zählt nicht', () => {
    const kv = memoryKV();
    kv.setLast('e5');
    expect(started(kv, COUNT)).toBe(false);
  });

  it('introDone: erst wenn die letzte Lektion nicht mehr offen ist', () => {
    const kv = memoryKV();
    for (let n = 1; n < COUNT; n++) kv.setBest(n, { moves: 9, pushes: 4 });
    expect(introDone(kv, COUNT)).toBe(false);
    kv.setFlag('skip', COUNT);
    expect(introDone(kv, COUNT)).toBe(true);
  });
});

describe('Levelwahl', () => {
  it('cardState: leer ist nur Lektion 1 frei, alle anderen gesperrt', () => {
    const kv = memoryKV();
    expect(cardState(kv, 1)).toBe('open');
    for (let n = 2; n <= COUNT; n++) expect(cardState(kv, n)).toBe('locked');
  });

  it('cardState: Status der freien Lektionen, die nächste wird frei', () => {
    const kv = memoryKV();
    kv.setBest(1, { moves: 9, pushes: 4 });
    kv.setFlag('skip', 2);
    kv.setFlag('shown', 3);
    expect(cardState(kv, 1)).toBe('done');
    expect(cardState(kv, 2)).toBe('skipped');
    expect(cardState(kv, 3)).toBe('shown');
    expect(cardState(kv, 4)).toBe('open');
    expect(cardState(kv, 5)).toBe('locked');
  });

  it('allSettled erst, wenn keine Lektion mehr offen ist', () => {
    const kv = memoryKV();
    expect(allSettled(kv, COUNT)).toBe(false);
    for (let n = 1; n < COUNT; n++) kv.setFlag('skip', n);
    expect(allSettled(kv, COUNT)).toBe(false);
    kv.setBest(COUNT, { moves: 1, pushes: 1 });
    expect(allSettled(kv, COUNT)).toBe(true);
  });

  it('allSettled nicht schon mit der letzten Lektion allein (anders als introDone)', () => {
    const kv = memoryKV();
    kv.setFlag('skip', COUNT);
    expect(introDone(kv, COUNT)).toBe(true);
    expect(allSettled(kv, COUNT)).toBe(false);
  });
});
