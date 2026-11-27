import { describe, expect, it } from 'vitest';
import { makeCamera, screenDirs } from '../../lib/games/oblique/camera';
import type { Picked } from '../../lib/games/oblique/geometry';
import { DIRS, nb, parseLevel } from '../../lib/games/sokoban/level';
import { type Game, busy, key, newGame, showSolution, tick, tip } from '../../lib/games/sokoban/state';
import { LESSONS } from '../../data/games/lessons';
import { type KeyInfo, SWIPE_PX, keepsKey, keyAction, padAngles, swipeDir, tapAt } from './ks-input';

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

describe('Wischen', () => {
  const flat = screenDirs(makeCamera(0, 90));
  it('bis 28 px ist es ein Tippen', () => {
    expect(SWIPE_PX).toBe(28);
    expect(swipeDir(28, 0, flat)).toBeNull();
    expect(swipeDir(0, -20, flat)).toBeNull();
    expect(swipeDir(25, 15, flat)).toBe('right'); // 29,2 px
  });

  it('von oben gesehen: die Bildschirmrichtung ist die Gitterrichtung', () => {
    expect(swipeDir(60, 0, flat)).toBe('right');
    expect(swipeDir(-60, 5, flat)).toBe('left');
    expect(swipeDir(3, -60, flat)).toBe('up');
    expect(swipeDir(0, 60, flat)).toBe('down');
  });

  it('schräg: die Gitterrichtung, deren Bildschirmrichtung am besten passt', () => {
    const dirs = screenDirs(makeCamera(45, 20));
    for (const s of dirs) expect(swipeDir(s.x * 60, s.y * 60, dirs)).toBe(s.name);
  });

  it('ohne Richtungen kein Schritt', () => {
    expect(swipeDir(60, 0, [])).toBeNull();
  });
});

describe('Steuerkreuz', () => {
  it('von oben gesehen zeigen die Pfeile hoch, rechts, runter, links', () => {
    expect(padAngles(screenDirs(makeCamera(0, 90)))).toEqual({ up: 0, right: 90, down: 180, left: 270 });
  });

  it('gedreht auf die Bildschirmrichtung der Kamera (atan2 + 90°, eine Nachkommastelle)', () => {
    const dirs = screenDirs(makeCamera(20, 50));
    const a = padAngles(dirs);
    for (const s of dirs) {
      const want = (Math.atan2(s.y, s.x) * 180) / Math.PI + 90;
      expect(a[s.name]).toBeCloseTo(want, 1);
    }
    expect(a.up).not.toBe(0);
  });

  it('ohne Richtungen die Grundstellung', () => {
    expect(padAngles([])).toEqual({ up: 0, down: 180, left: -90, right: 90 });
  });
});

describe('Antippen (tapAt)', () => {
  /** Lektion 1 und 4 als Felder (Daten liegen in data/games; hier reicht das Feld) */
  const L1 = parseLevel('#########\n#       #\n# ##### #\n#.   $  #\n# ##### #\n#    @  #\n#########');
  const L4 = parseLevel('########\n#      #\n#  $   #\n#  @   #\n#     .#\n########');
  let t = 0;
  const settle = (g: Game): Game => {
    let s = g;
    for (let i = 0; i < 500 && busy(s); i++) s = tick(s, (t += 1000));
    return s;
  };
  const at = (L: typeof L1, r: number, c: number) => r * L.W + c;
  const floor = (r: number, c: number) => ({ type: 'floor', r, c }) as const;
  const crate = (id: number): Picked => ({ type: 'crate', id, k: 0, poly: [] });

  it('auf ein erreichbares Bodenfeld: die Figur läuft hin, als eine Aktion (ein Schnappschuss)', () => {
    const g = settle(tapAt(newGame(L1), floor(5, 1), (t += 1)));
    expect(g).toMatchObject({ p: at(L1, 5, 1), moves: 4, pushes: 0 });
    expect(g.hist).toHaveLength(1);
  });

  it('auf die Figur: nichts zu laufen, die Auswahl geht weg', () => {
    const sel = tapAt(newGame(L1), crate(0), 0);
    expect(sel.sel).toBe(0);
    const g = tapAt(sel, { type: 'fig', k: 0, poly: [] }, 0);
    expect(g).toMatchObject({ sel: null, moves: 0 });
  });

  it('Kiste antippen wählt sie, noch einmal hebt die Wahl auf', () => {
    const g = tapAt(newGame(L1), crate(0), 0);
    expect(g.sel).toBe(0);
    expect(tapAt(g, crate(0), 0).sel).toBeNull();
  });

  it('ein Pfeilfeld der gewählten Kiste: hinlaufen und schieben', () => {
    const g = settle(tapAt(tapAt(newGame(L1), crate(0), 0), floor(3, 4), (t += 1)));
    expect(g).toMatchObject({ boxes: [at(L1, 3, 4)], p: at(L1, 3, 5), moves: 6, pushes: 1 });
    expect(g.hist).toHaveLength(1);
  });

  it('Kiste ohne Möglichkeit: Meldung „noOptions“', () => {
    // Lektion 4: Kiste in die Ecke (ruLL, dlU)
    let g = newGame(L4);
    for (const ch of 'rulldlu')
      g = settle(key(g, DIRS[({ r: 'right', u: 'up', l: 'left', d: 'down' } as const)[ch as 'r']], (t += 1)));
    expect(g.boxes).toEqual([at(L4, 1, 1)]);
    expect(tapAt(g, crate(0), 0)).toMatchObject({ sel: 0, msg: 'noOptions' });
  });

  it('unerreichbar oder daneben: Auswahl und Tipp weg; ohne Auswahl bleibt alles, wie es ist', () => {
    const hinted = tip(newGame(L1));
    expect(hinted.sel).toBe(0);
    expect(tapAt(hinted, null, 0)).toMatchObject({ sel: null, hint: null });
    expect(tapAt(hinted, floor(0, 0), 0)).toMatchObject({ sel: null, hint: null, moves: 0 });
    const plain = newGame(L1);
    expect(tapAt(plain, null, 0)).toBe(plain);
  });

  // Issue #14, Lektion 6 am Start: Der Tipp zeigt nur „runter“. Das Feld darüber (hoch = Kiste an die Wand) ist kein
  // gezeigter Pfeil mehr, also darf ein Tippen dort auch nicht schieben, sondern die Figur läuft hin.
  it('mit Tipp schiebt nur sein Pfeil: das verborgene Pfeilfeld ist ein normales Bodenfeld', () => {
    const L6 = parseLevel(LESSONS[5]!.xsb);
    const hinted = tip(newGame(L6));
    expect(hinted.hint?.d).toBe('down');
    const id = hinted.hint!.box;
    const box = hinted.boxes[id]!;
    const above = nb(L6, box, DIRS.up);
    const g = settle(tapAt(hinted, floor(Math.floor(above / L6.W), above % L6.W), (t += 1)));
    expect(g).toMatchObject({ pushes: 0, p: above, sel: null, hint: null });
    expect(g.boxes[id]).toBe(box);
    // das Pfeilfeld des Tipps schiebt weiter
    const below = nb(L6, box, DIRS.down);
    const pushed = settle(tapAt(hinted, floor(Math.floor(below / L6.W), below % L6.W), (t += 1)));
    expect(pushed).toMatchObject({ pushes: 1 });
    expect(pushed.boxes[id]).toBe(below);
  });

  it('ein anderes Feld bei gewählter Kiste ist kein Pfeil: dorthin laufen', () => {
    const g = settle(tapAt(tapAt(newGame(L1), crate(0), 0), floor(5, 7), (t += 1)));
    expect(g).toMatchObject({ p: at(L1, 5, 7), moves: 2, sel: null });
  });

  it('während einer Animation und nach dem Sieg nichts; beim Vorspielen nur abbrechen', () => {
    const moving = tapAt(newGame(L1), floor(5, 1), (t += 1));
    expect(moving.a).not.toBeNull();
    expect(tapAt(moving, floor(5, 7), t)).toBe(moving);
    const auto = showSolution(newGame(L1), (t += 1));
    expect(auto.auto).toBe(true);
    const stopped = tapAt(auto, floor(5, 1), t);
    expect(stopped).toMatchObject({ auto: false, q: [], msg: null });
    const won = settle(showSolution(newGame(L1), (t += 1)));
    expect(won.won).toBe(true);
    expect(tapAt(won, floor(5, 1), t)).toBe(won);
  });
});
