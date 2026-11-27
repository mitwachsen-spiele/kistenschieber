import { describe, expect, it } from 'vitest';
import { type KeyInfo, keepsKey, keyAction } from './ks-input';

const k = (key: string, more: Partial<KeyInfo> = {}): KeyInfo => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  inField: false,
  onControl: false,
  dialogOpen: false,
  ...more,
});

describe('keyAction', () => {
  it('Pfeiltasten und WASD (klein und groß) laufen', () => {
    const cases: [string, string][] = [
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
      ['w', 'up'],
      ['s', 'down'],
      ['a', 'left'],
      ['d', 'right'],
      ['W', 'up'],
      ['S', 'down'],
      ['A', 'left'],
      ['D', 'right'],
    ];
    for (const [key, d] of cases) expect(keyAction(k(key), false)).toEqual({ kind: 'step', d });
  });

  it('Z, Backspace zurück; R neu; H Tipp; M Menü; Esc', () => {
    for (const key of ['z', 'Z', 'Backspace']) expect(keyAction(k(key), false)).toEqual({ kind: 'undo' });
    for (const key of ['r', 'R']) expect(keyAction(k(key), false)).toEqual({ kind: 'restart' });
    for (const key of ['h', 'H']) expect(keyAction(k(key), false)).toEqual({ kind: 'tip' });
    for (const key of ['m', 'M']) expect(keyAction(k(key), false)).toEqual({ kind: 'menu' });
    expect(keyAction(k('Escape'), false)).toEqual({ kind: 'escape' });
  });

  it('Enter geht nur nach dem Sieg weiter und nicht, wenn ein Knopf oder Link den Fokus hat', () => {
    expect(keyAction(k('Enter'), true)).toEqual({ kind: 'next' });
    expect(keyAction(k('Enter'), false)).toEqual({ kind: 'other' });
    expect(keyAction(k('Enter', { onControl: true }), true)).toEqual({ kind: 'other' });
  });

  it('andere Tasten sind „other“ (beenden das Vorspielen)', () => {
    expect(keyAction(k('x'), false)).toEqual({ kind: 'other' });
    expect(keyAction(k(' '), true)).toEqual({ kind: 'other' });
  });

  it('ignoriert Tasten mit Alt, Strg, Meta, in Formularfeldern und bei offenem Dialog', () => {
    for (const more of [
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { inField: true },
      { dialogOpen: true },
    ] as Partial<KeyInfo>[]) {
      expect(keyAction(k('ArrowUp', more), false)).toBeNull();
      expect(keyAction(k('z', more), false)).toBeNull();
      expect(keyAction(k('Enter', more), true)).toBeNull();
    }
  });
});

describe('keepsKey', () => {
  it('Laufen, Zurück und Esc behalten die Taste (kein Scrollen, kein Zurück im Browser)', () => {
    expect(keepsKey({ kind: 'step', d: 'up' })).toBe(true);
    expect(keepsKey({ kind: 'undo' })).toBe(true);
    expect(keepsKey({ kind: 'escape' })).toBe(true);
    for (const kind of ['restart', 'tip', 'menu', 'next', 'other'] as const) expect(keepsKey({ kind })).toBe(false);
  });
});
