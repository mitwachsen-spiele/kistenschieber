import { describe, expect, it } from 'vitest';
import { DIRS, type DirKey, parseLevel, parseLurd } from '../../lib/games/sokoban/level';
import {
  DURATION,
  type Game,
  act,
  again,
  busy,
  key,
  newGame,
  restart,
  showSolution,
  tick,
  tip,
  undo,
} from '../../lib/games/sokoban/state';
import { type Note, MAX_VOICES, SOUNDS, STEP_GAP, WIN_AFTER, cues } from './ks-sound';

/** Wie Lektion 1: vier Schübe nach links bis aufs Ziel */
const LESSON1 = '#########\n#       #\n# ##### #\n#.   $  #\n# ##### #\n#    @  #\n#########';
/** Wie Lektion 3: zwei Kisten, zwei Ziele */
const LESSON3 = '#######\n#.   .#\n#     #\n# $ $ #\n#  @  #\n#######';
/** Zum Anstoßen: Wand oben, unten eine Kiste mit Wand dahinter */
const ONE_PUSH = '######\n#@$. #\n#  $##\n#   .#\n######';

const LETTER: Record<string, DirKey> = { u: 'up', d: 'down', l: 'left', r: 'right' };

/** Spielt wie ks-game.ts: Eingabe, dann Bilder alle 50 ms; merkt jeden Ton mit Zeit (ms) */
function player(xsb: string, opts: { sol?: string; reduce?: boolean } = {}) {
  let g = newGame(parseLevel(xsb), opts);
  let t = 1000;
  let lastStep = -Infinity;
  const log: { sound: string; t: number; at: number }[] = [];
  const apply = (next: Game) => {
    const r = cues(g, next, lastStep);
    lastStep = r.lastStep;
    for (const c of r.cues) log.push({ sound: c.sound, t, at: c.at });
    g = next;
  };
  const frames = (n = 4) => {
    for (let i = 0; i < n; i++) {
      t += 50;
      apply(tick(g, t));
    }
  };
  return {
    log,
    sounds: () => log.map((l) => l.sound),
    get g() {
      return g;
    },
    do(fn: (g: Game, now: number) => Game, n = 4) {
      apply(fn(g, t));
      frames(n);
    },
    /** Tasten in LURD, je Taste die Bilder bis der Schritt fertig ist */
    keys(lurd: string, n = 4) {
      for (const ch of lurd) this.do((s, now) => key(s, DIRS[LETTER[ch.toLowerCase()]!], now), n);
    },
    /** bis nichts mehr läuft */
    settle() {
      for (let i = 0; i < 5000 && busy(g); i++) frames(1);
    },
  };
}

describe('Töne beim Spielen', () => {
  it('Lektion 1: jeder Schritt tickt, jeder Schub poltert, der letzte rastet ein, dann „Geschafft!“', () => {
    const p = player(LESSON1);
    p.keys('rruulLLLL');
    expect(p.g.won).toBe(true);
    expect(p.sounds()).toEqual(['step', 'step', 'step', 'step', 'step', 'push', 'push', 'push', 'push', 'lock', 'win']);
  });

  it('Einrasten, wenn die Kiste ankommt (nach dem Schub), die Melodie kurz danach', () => {
    const p = player(LESSON1);
    p.keys('rruulLLL');
    p.do((s, now) => key(s, DIRS.left, now), 0);
    expect(p.log.at(-1)).toMatchObject({ sound: 'lock', at: DURATION.push / 1000 });
    p.settle();
    expect(p.log.at(-1)).toMatchObject({ sound: 'win', at: WIN_AFTER });
  });

  it('Lektion 3: die erste Kiste auf ihrem Ziel rastet ein, ohne Melodie', () => {
    const p = player(LESSON3);
    p.keys('uLdlUU');
    // Das Schild schweigt (die grüne Kiste zeigt es selbst, #11); zu hören ist das Einrasten
    expect(p.g.msg).toBeNull();
    expect(p.sounds().filter((s) => s !== 'step')).toEqual(['push', 'push', 'push', 'lock']);
  });

  it('ein Schub neben das Ziel rastet nicht ein', () => {
    const p = player(LESSON1);
    p.keys('rruulL');
    expect(p.sounds().slice(-1)).toEqual(['push']);
  });

  it('Anstoßen und eine Kiste ohne Platz dahinter sind still', () => {
    const p = player(ONE_PUSH);
    p.keys('u'); // Wand
    expect(p.log).toEqual([]);
    p.keys('dr');
    p.keys('r'); // Kiste, dahinter die Wand
    expect(p.g.msg).toBe('blocked');
    p.keys('l');
    expect(p.sounds()).toEqual(['step', 'step', 'step']);
  });

  it('ein langer Laufweg tickt nur alle STEP_GAP ms, nicht bei jedem Schritt', () => {
    const p = player(LESSON1);
    const path = parseLurd('llllurrrrrr').map((x) => x.dir);
    p.do((s, now) => act(s, path, now), 0);
    p.settle();
    const steps = p.log.filter((l) => l.sound === 'step');
    expect(steps.length).toBeGreaterThan(1);
    expect(steps.length).toBeLessThan(path.length / 2 + 1);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!.t - steps[i - 1]!.t).toBeGreaterThanOrEqual(STEP_GAP);
  });

  it('einzelne Schritte mit Pause ticken jedes Mal', () => {
    const p = player(LESSON1);
    p.keys('llll', 6);
    expect(p.sounds()).toEqual(['step', 'step', 'step', 'step']);
  });

  it('Zug zurück, Neustart, Nochmal und Tipp sind still, auch Zug zurück auf einen alten Sieg', () => {
    const p = player(LESSON1);
    p.keys('rruulLLLL');
    const before = p.log.length;
    p.do((s) => restart(s));
    p.do((s) => undo(s)); // wieder gewonnen
    expect(p.g.won).toBe(true);
    p.do((s) => undo(s));
    p.do((s) => again(s));
    p.do((s) => tip(s));
    p.do((s) => undo(s));
    expect(p.log.slice(before)).toEqual([]);
  });

  it('Zug zurück mitten im Schub spielt keine Melodie', () => {
    const p = player(LESSON1);
    p.keys('rruulLLL');
    p.do((s, now) => key(s, DIRS.left, now), 0);
    p.do((s) => undo(s));
    expect(p.sounds().filter((s) => s === 'win')).toEqual([]);
  });

  it('beim Vorspielen nur Einrasten und Melodie, keine Schritte und kein Poltern', () => {
    const p = player(LESSON3, { sol: 'uLdlUUdrrRdrUU' });
    p.do((s, now) => showSolution(s, now), 0);
    p.settle();
    expect(p.g.shownWin).toBe(true);
    expect(p.sounds()).toEqual(['lock', 'lock', 'win']);
  });

  it('mitten in der Lektion Schub für Schub mit dem Löser: ebenso ruhig', () => {
    const p = player(LESSON1);
    p.keys('rr');
    p.do((s, now) => showSolution(s, now), 0);
    p.settle();
    expect(p.sounds()).toEqual(['step', 'step', 'lock', 'win']);
  });

  it('weniger Bewegung: dieselben Töne, das Einrasten sofort', () => {
    const p = player(LESSON1, { reduce: true });
    p.keys('rruulLLLL', 1);
    expect(p.sounds().filter((s) => s !== 'step')).toEqual(['push', 'push', 'push', 'push', 'lock', 'win']);
    expect(p.log.find((l) => l.sound === 'lock')?.at).toBe(0.001);
  });
});

describe('Klang', () => {
  const TAIL = 0.03; // so lange klingt ein Ton nach (sfx.ts)
  const end = ([, len, , , , at]: Note) => at + len + TAIL;
  /** höchstens so viele Töne klingen zugleich */
  const voices = (notes: readonly Note[]) =>
    Math.max(...notes.map(([, , , , , at]) => notes.filter((n) => n[5] <= at && at < end(n)).length));

  it('kurz und leise: jeder Ton unter 0,5 s, Lautstärke höchstens 0,12, alles unter 1 s', () => {
    for (const [id, notes] of Object.entries(SOUNDS)) {
      for (const n of notes) {
        expect(n[1], id).toBeLessThan(0.5);
        expect(n[3], id).toBeLessThanOrEqual(0.12);
        expect(n[3], id).toBeGreaterThan(0);
      }
      expect(Math.max(...notes.map(end)), id).toBeLessThan(1);
    }
  });

  it('der Schritt ist der leiseste und kürzeste Ton', () => {
    const [step] = SOUNDS.step;
    for (const n of [...SOUNDS.push, ...SOUNDS.lock, ...SOUNDS.win]) expect(n[3]).toBeGreaterThanOrEqual(step![3]);
    expect(step![1]).toBeLessThan(0.06);
  });

  it('Einrasten klingt anders als Poltern: hell und mit Glockenton statt tief mit Rauschen', () => {
    const tones = (notes: readonly Note[]) => notes.filter((n) => n[2] !== 'noise').map((n) => n[0]);
    expect(Math.min(...tones(SOUNDS.lock))).toBeGreaterThan(4 * Math.max(...tones(SOUNDS.push)));
    expect(SOUNDS.lock.some((n) => n[2] === 'noise')).toBe(false);
    expect(SOUNDS.push.some((n) => n[2] === 'noise')).toBe(true);
  });

  it('Einrasten und Melodie zusammen bleiben unter MAX_VOICES Stimmen', () => {
    const both = [...SOUNDS.lock, ...SOUNDS.win.map(([f, l, w, g, s, at]): Note => [f, l, w, g, s, at + WIN_AFTER])];
    expect(voices(both)).toBeLessThanOrEqual(MAX_VOICES);
    expect(MAX_VOICES).toBe(6);
  });

  it('die Melodie steigt in Dur (C E G C)', () => {
    expect(SOUNDS.win.map(([f]) => Math.round(12 * Math.log2(f / 523.25)))).toEqual([0, 4, 7, 12]);
  });
});
