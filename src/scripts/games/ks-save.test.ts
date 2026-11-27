import { describe, expect, it } from 'vitest';
import { lastRef, markSkipped, recordWin, stateOf, unlocked } from '../../lib/games/sokoban/progress';
import { KEYS, PREFIX, SETTINGS_DEFAULT, isBest, loadSettings, progressKV, saveSetting, type Store } from './ks-save';

/** Speicher im Arbeitsspeicher wie localStorage */
function memoryStore(init: Record<string, string> = {}): Store & { data: Map<string, string> } {
  const data = new Map(Object.entries(init).map(([k, v]) => [PREFIX + k, v]));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
/** Speicher, der jeden Zugriff verweigert (privates Fenster, voll) */
const brokenStore: Store = {
  getItem: () => {
    throw new Error('verboten');
  },
  setItem: () => {
    throw new Error('voll');
  },
  removeItem: () => {
    throw new Error('verboten');
  },
};

describe('Einstellungen', () => {
  it('ohne Werte die Standardwerte 20°, 50°, rechte Hand, Ton an', () => {
    expect(loadSettings(memoryStore())).toEqual({ drehung: 20, neigung: 50, hand: 'rechts', ton: 'an' });
  });

  it('gültige Werte inklusive der Grenzen', () => {
    expect(loadSettings(memoryStore({ drehung: '0', neigung: '80', hand: '"links"', ton: '"aus"' }))).toEqual({
      drehung: 0,
      neigung: 80,
      hand: 'links',
      ton: 'aus',
    });
    expect(loadSettings(memoryStore({ drehung: '45', neigung: '20' }))).toMatchObject({ drehung: 45, neigung: 20 });
  });

  it.each([
    ['außerhalb', { drehung: '46', neigung: '19', hand: '"mitte"', ton: '"leise"' }],
    ['negativ', { drehung: '-1', neigung: '81', hand: '"Links"', ton: '"Aus"' }],
    ['falscher Typ', { drehung: '"30"', neigung: 'true', hand: '1', ton: 'false' }],
    ['kein JSON', { drehung: 'drei', neigung: '{', hand: 'links', ton: 'aus' }],
    ['null', { drehung: 'null', neigung: 'null', hand: 'null', ton: 'null' }],
  ])('%s → Standardwerte', (_, init) => {
    expect(loadSettings(memoryStore(init))).toEqual(SETTINGS_DEFAULT);
  });

  it('speichert mit Präfix als JSON', () => {
    const store = memoryStore();
    saveSetting(store, 'drehung', 30);
    saveSetting(store, 'hand', 'links');
    saveSetting(store, 'ton', 'aus');
    expect(store.data.get('kistenschieber.drehung')).toBe('30');
    expect(store.data.get('kistenschieber.hand')).toBe('"links"');
    expect(store.data.get('kistenschieber.ton')).toBe('"aus"');
    expect(loadSettings(store)).toEqual({ drehung: 30, neigung: 50, hand: 'links', ton: 'aus' });
  });
});

describe('Fortschritt', () => {
  it('Schlüssel best.eN, skip.eN, shown.eN, last mit Präfix', () => {
    const store = memoryStore();
    const kv = progressKV(store);
    kv.setBest(1, { moves: 9, pushes: 4 });
    kv.setFlag('skip', 2);
    kv.setFlag('shown', 3);
    kv.setLast(3);
    expect(Object.fromEntries(store.data)).toEqual({
      'kistenschieber.best.e1': '{"moves":9,"pushes":4}',
      'kistenschieber.skip.e2': 'true',
      'kistenschieber.shown.e3': 'true',
      'kistenschieber.last': '"e3"',
    });
    expect(kv.best(1)).toEqual({ moves: 9, pushes: 4 });
    expect([kv.flag('skip', 2), kv.flag('shown', 3), kv.flag('skip', 3)]).toEqual([true, true, false]);
    expect(kv.last()).toBe(3);
    expect(KEYS.best(7)).toBe('best.e7');
  });

  it('Level: Schlüssel best.lN, skip.lN, shown.lN, last.l, getrennt von der Einführung', () => {
    const store = memoryStore({ 'best.e1': '{"moves":9,"pushes":4}', last: '"e5"' });
    const kv = progressKV(store, 'l');
    expect([kv.best(1), kv.last()]).toEqual([null, null]);
    kv.setBest(1, { moves: 25, pushes: 10 });
    kv.setFlag('skip', 2);
    kv.setFlag('shown', 3);
    kv.setLast(2);
    expect(Object.fromEntries(store.data)).toMatchObject({
      'kistenschieber.best.l1': '{"moves":25,"pushes":10}',
      'kistenschieber.skip.l2': 'true',
      'kistenschieber.shown.l3': 'true',
      'kistenschieber.last.l': '"l2"',
      'kistenschieber.last': '"e5"',
    });
    expect(kv.last()).toBe(2);
    expect(progressKV(store).last()).toBe(5);
    expect(progressKV(store).best(1)).toEqual({ moves: 9, pushes: 4 });
    expect(progressKV(memoryStore({ 'last.l': '"e2"' }), 'l').last()).toBeNull();
  });

  it('Level mit Kalender: open kommt durch, ohne gibt es keins', () => {
    const kv = progressKV(memoryStore(), 'l', (n) => n <= 2);
    expect([kv.open?.(2), kv.open?.(3)]).toEqual([true, false]);
    expect(unlocked(kv, 1)).toBe(true);
    expect('open' in progressKV(memoryStore())).toBe(false);
  });

  it.each([
    ['fehlt', null],
    ['kein Objekt', '9'],
    ['null', 'null'],
    ['Text statt Zahl', '{"moves":"9","pushes":4}'],
    ['keine ganze Zahl', '{"moves":9.5,"pushes":4}'],
    ['negativ', '{"moves":9,"pushes":-1}'],
    ['mehr Schübe als Züge', '{"moves":3,"pushes":4}'],
    ['null Züge', '{"moves":0,"pushes":0}'],
    ['kein JSON', '{moves:9}'],
  ])('ungültiger Bestwert (%s) gilt als fehlend', (_, raw) => {
    const kv = progressKV(memoryStore(raw === null ? {} : { 'best.e1': raw }));
    expect(kv.best(1)).toBeNull();
  });

  it('Bestwert ohne zusätzliche Felder', () => {
    const kv = progressKV(memoryStore({ 'best.e1': '{"moves":9,"pushes":4,"x":1}' }));
    expect(kv.best(1)).toEqual({ moves: 9, pushes: 4 });
    expect(isBest({ moves: 1, pushes: 0 })).toBe(true);
  });

  it.each([
    ['1', 'Zahl'],
    ['"true"', 'Text'],
    ['false', 'false'],
  ])('Merker nur bei true (%s, %s)', (raw) => {
    expect(progressKV(memoryStore({ 'skip.e1': raw, 'shown.e1': raw })).flag('skip', 1)).toBe(false);
  });

  it.each(['7', '"l3"', '"e0"', '"e"', '"e01"', '"7"', '{"n":7}'])('last %s ist ungültig', (raw) => {
    expect(progressKV(memoryStore({ last: raw })).last()).toBeNull();
  });

  it('arbeitet mit lib/games/sokoban/progress zusammen', () => {
    const store = memoryStore({ 'best.e1': '{"moves":9,"pushes":4}', last: '"e9"' });
    const kv = progressKV(store);
    expect(unlocked(kv, 2)).toBe(true);
    expect(lastRef(kv, 15)).toBe(2);
    expect(markSkipped(kv, 1)).toBe(false);
    expect(store.data.has('kistenschieber.skip.e1')).toBe(false);
    expect(recordWin(kv, 2, { moves: 6, pushes: 4, shown: false })).toBe(true);
    expect(stateOf(kv, 2)).toBe('done');
  });
});

describe('Speicher, der Fehler wirft', () => {
  it('liefert Standardwerte und wirft nie', () => {
    expect(loadSettings(brokenStore)).toEqual(SETTINGS_DEFAULT);
    expect(() => saveSetting(brokenStore, 'neigung', 60)).not.toThrow();
    const kv = progressKV(brokenStore);
    expect([kv.best(1), kv.flag('shown', 1), kv.last()]).toEqual([null, false, null]);
    expect(() => {
      kv.setBest(1, { moves: 9, pushes: 4 });
      kv.setFlag('skip', 1);
      kv.setLast(1);
    }).not.toThrow();
    expect(lastRef(kv, 15)).toBe(1);
  });
});
