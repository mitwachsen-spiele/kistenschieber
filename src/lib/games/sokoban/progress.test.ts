import { describe, expect, it } from 'vitest';
import {
  type Best,
  type Flag,
  type ProgressKV,
  cardState,
  dayCome,
  doneCount,
  firstPlayable,
  introComplete,
  lastRef,
  markOpened,
  markShown,
  markSkipped,
  nextOpen,
  recordWin,
  skippedCount,
  startPoint,
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
    last: () => (data.get('last') as number | undefined) ?? null,
    setBest: (n, best) => void data.set(`best.e${n}`, best),
    setFlag: (kind, n) => void data.set(`${kind}.e${n}`, true),
    setLast: (n) => void data.set('last', n),
  };
}

/** Level mit Kalender: offen sind die ersten `days` */
function calendarKV(days: number) {
  const kv = memoryKV();
  return Object.assign(kv, { open: (n: number) => n <= days });
}

describe('Kalender (Level)', () => {
  it('vor dem ersten Tag ist nichts frei, auch nicht Nummer 1', () => {
    const kv = calendarKV(0);
    expect(unlocked(kv, 1)).toBe(false);
    expect(nextOpen(kv, 6)).toBe(0);
    expect(firstPlayable(kv, 6)).toBe(1);
    expect(markOpened(kv, 1)).toBe(false);
    expect(cardState(kv, 1)).toBe('locked');
    expect(started(kv, 6)).toBe(false);
  });

  it('frei ist nur, wessen Tag gekommen ist und dessen Vorgänger nicht mehr offen ist', () => {
    const kv = calendarKV(3);
    expect([1, 2, 3, 4].map((n) => unlocked(kv, n))).toEqual([true, false, false, false]);
    kv.setBest(1, { moves: 25, pushes: 10 });
    kv.setFlag('skip', 2);
    expect([1, 2, 3, 4].map((n) => unlocked(kv, n))).toEqual([true, true, true, false]);
    kv.setBest(3, { moves: 47, pushes: 14 });
    // Level 4 hat seinen Tag noch nicht, obwohl 3 geschafft ist
    expect(unlocked(kv, 4)).toBe(false);
    expect(dayCome(kv, 4)).toBe(false);
    expect(dayCome(kv, 3)).toBe(true);
  });

  it('nextOpen: erstes freies offenes, sonst 0; firstPlayable dann das letzte freie', () => {
    const kv = calendarKV(2);
    expect(nextOpen(kv, 6)).toBe(1);
    kv.setBest(1, { moves: 25, pushes: 10 });
    expect(nextOpen(kv, 6)).toBe(2);
    kv.setBest(2, { moves: 27, pushes: 11 });
    expect(nextOpen(kv, 6)).toBe(0);
    expect(firstPlayable(kv, 6)).toBe(2);
    expect(lastRef(kv, 6)).toBe(2);
  });

  it('ohne Kalender ist jeder Tag gekommen', () => {
    expect(dayCome(memoryKV(), 99)).toBe(true);
  });
});

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
    kv.setLast(1);
    expect(lastRef(kv, COUNT)).toBe(1);
  });

  it.each([
    ['fehlt', null],
    ['zu groß', 16],
    ['null', 0],
    ['gesperrt', 9],
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
    expect(kv.last()).toBe(1);
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
    kv.setLast(1);
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
    kv.setLast(5);
    expect(started(kv, COUNT)).toBe(false);
  });

  const solve = (kv: ProgressKV, ...ns: number[]) => ns.forEach((n) => kv.setBest(n, { moves: 9, pushes: 4 }));
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  it('startPoint: solange eine Lektion offen ist, wie lastRef', () => {
    const kv = memoryKV();
    expect(startPoint(kv, COUNT)).toEqual({ n: 1, repeat: false });
    solve(kv, 1, 2);
    kv.setLast(2);
    expect(startPoint(kv, COUNT)).toEqual({ n: 2, repeat: false });
    kv.setFlag('skip', 3);
    expect(startPoint(kv, COUNT)).toEqual({ n: lastRef(kv, COUNT), repeat: false });
  });

  it('startPoint: nichts mehr offen, aber übersprungen: zur ersten übersprungenen, nicht zur gelösten letzten', () => {
    const kv = memoryKV();
    solve(kv, ...range(1, 15).filter((n) => n !== 7));
    kv.setFlag('skip', 7);
    kv.setLast(15);
    expect(startPoint(kv, COUNT)).toEqual({ n: 7, repeat: false });
    const all = memoryKV();
    for (let n = 1; n <= COUNT; n++) all.setFlag('skip', n);
    all.setLast(15);
    expect(startPoint(all, COUNT)).toEqual({ n: 1, repeat: false });
  });

  it('startPoint: mehrere übersprungen: immer die erste, auch wenn zuletzt eine spätere offen war', () => {
    const kv = memoryKV();
    solve(kv, ...range(1, 15).filter((n) => n !== 3 && n !== 9));
    kv.setFlag('skip', 3);
    kv.setFlag('skip', 9);
    kv.setLast(9);
    expect(startPoint(kv, COUNT)).toEqual({ n: 3, repeat: false });
    solve(kv, 3);
    expect(startPoint(kv, COUNT)).toEqual({ n: 9, repeat: false });
  });

  it('startPoint: geschafft heißt wiederholen, außer eine Wiederholung läuft schon', () => {
    const kv = memoryKV();
    solve(kv, ...range(1, 14));
    kv.setFlag('shown', 15);
    expect(startPoint(kv, COUNT)).toEqual({ n: 1, repeat: true });
    kv.setLast(15);
    expect(startPoint(kv, COUNT)).toEqual({ n: 1, repeat: true });
    kv.setLast(6);
    expect(startPoint(kv, COUNT)).toEqual({ n: 6, repeat: false });
    kv.setLast(1);
    expect(startPoint(kv, COUNT)).toEqual({ n: 1, repeat: false });
  });

  it('skippedCount: nur übersprungen und nicht nachgeholt', () => {
    const kv = memoryKV();
    kv.setFlag('skip', 2);
    kv.setFlag('skip', 4);
    kv.setFlag('skip', 5);
    solve(kv, 4);
    kv.setFlag('shown', 5);
    expect(skippedCount(kv, COUNT)).toBe(1);
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

  it('introComplete: erst wenn jede Lektion geschafft oder mit Lösung gesehen ist', () => {
    const kv = memoryKV();
    expect(introComplete(kv, COUNT)).toBe(false);
    for (let n = 1; n < COUNT; n++) kv.setBest(n, { moves: 9, pushes: 4 });
    expect(introComplete(kv, COUNT)).toBe(false);
    kv.setFlag('shown', COUNT);
    expect(introComplete(kv, COUNT)).toBe(true);
  });

  it('introComplete: Übersprungene zählen nicht, auch nicht die letzte allein', () => {
    const kv = memoryKV();
    for (let n = 1; n <= COUNT; n++) kv.setFlag('skip', n);
    expect(introComplete(kv, COUNT)).toBe(false);
    for (let n = 2; n <= COUNT; n++) kv.setBest(n, { moves: 9, pushes: 4 });
    expect(introComplete(kv, COUNT)).toBe(false);
    kv.setBest(1, { moves: 9, pushes: 4 });
    expect(introComplete(kv, COUNT)).toBe(true);
  });
});
