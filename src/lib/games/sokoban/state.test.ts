import { describe, expect, it } from 'vitest';
import { DIRS, type Dir, parseLevel, parseLurd } from './level';
import { solve } from './solver';
import {
  AUTO_SLOWER,
  DURATION,
  UNDO_LIMIT,
  act,
  again,
  busy,
  dirKey,
  duration,
  key,
  msgKind,
  newGame,
  options,
  pushVia,
  restart,
  showSolution,
  step,
  stopAuto,
  tick,
  tip,
  toggleSelect,
  undo,
  type Game,
} from './state';

/** Friert den Zustand samt Arrays und Objekten ein: Jede Mutation wirft (ES-Module laufen strikt) */
function deepFreeze<T>(x: T): T {
  if (typeof x !== 'object' || x === null || Object.isFrozen(x) || x instanceof Set || x instanceof Map) return x;
  Object.freeze(x);
  for (const v of Object.values(x)) deepFreeze(v);
  return x;
}

let clock = 0;
const later = () => (clock += 1000);
/** Takte bis nichts mehr läuft (Animation, Puffer, Vorspielen) */
function settle(g: Game): Game {
  let s = deepFreeze(g);
  for (let i = 0; i < 5000 && busy(s); i++) s = deepFreeze(tick(s, later()));
  return s;
}
/**
 * Felder wie die Lektionen 1–4 und 15 (lib kennt data/games nicht). Die Tests über alle 15 Lektionen stehen in
 * src/data/games/lessons.test.ts
 */
const FIELDS: Readonly<Record<number, { xsb: string; sol?: string; moves?: number; pushes?: number }>> = {
  1: {
    xsb: '#########\n#       #\n# ##### #\n#.   $  #\n# ##### #\n#    @  #\n#########',
    sol: 'rruulLLLL',
    moves: 9,
    pushes: 4,
  },
  2: { xsb: '######\n#    #\n#@$  #\n##   #\n #   #\n # . #\n #####', sol: 'RurDDD' },
  3: { xsb: '#######\n#.   .#\n#     #\n# $ $ #\n#  @  #\n#######', sol: 'uLdlUUdrrRdrUU' },
  4: { xsb: '########\n#      #\n#  $   #\n#  @   #\n#     .#\n########' },
  15: { xsb: ' #########\n #@  #   #\n # $ $ $ #\n## ## ## #\n#  ...   #\n#  #*#  ##\n#       #\n#########' },
};
const lesson = (n: number) => FIELDS[n]!;
const gameOf = (n: number, reduce = false) =>
  deepFreeze(newGame(parseLevel(lesson(n).xsb), { sol: lesson(n).sol, reduce }));
const dirs = (lurd: string): Dir[] => parseLurd(lurd).map((s) => s.dir);
/** Tasten nacheinander, jede bis zum Ende abgespielt */
function press(g: Game, lurd: string): Game {
  let s = g;
  for (const d of dirs(lurd)) s = settle(key(s, d, later()));
  return s;
}

describe('step', () => {
  const g = gameOf(1);

  it('läuft: Figur weiter, ein Zug, kein Schub', () => {
    const { game, move } = step(g, DIRS.right);
    expect(move).toEqual({ kind: 'walk', from: g.p, to: g.p + 1 });
    expect(game).toMatchObject({ p: g.p + 1, moves: 1, pushes: 0, dir: 'i' });
  });

  it('stößt an die Wand (bump): kein Zug, nur die Blickrichtung', () => {
    const { game, move } = step(g, DIRS.down);
    expect(move).toEqual({ kind: 'bump' });
    expect(game).toMatchObject({ p: g.p, moves: 0, dir: 'j' });
  });

  it('schiebt eine Kiste: Zug und Schub, Kiste rückt weiter', () => {
    const s = press(g, 'rruul');
    const { game, move } = step(s, DIRS.left);
    const box = s.boxes[0]!;
    expect(move).toEqual({ kind: 'push', from: s.p, to: box, box: 0, bfrom: box, bto: box - 1 });
    expect(game).toMatchObject({ p: box, boxes: [box - 1], moves: s.moves + 1, pushes: s.pushes + 1, dir: '-i' });
  });

  it('blockiert, wenn hinter der Kiste kein Platz ist: kein Zug', () => {
    const B = deepFreeze(newGame(parseLevel('#######\n#@$$..#\n#######')));
    const { game, move } = step(B, DIRS.right);
    expect(move).toEqual({ kind: 'blocked' });
    expect(game).toMatchObject({ p: B.p, boxes: B.boxes, moves: 0, pushes: 0, dir: 'i' });
  });
});

describe('Züge und Animation', () => {
  it('blockiert per Taste mit Meldung und ohne Zug', () => {
    const B = deepFreeze(newGame(parseLevel('#######\n#@$$..#\n#######')));
    const s = key(B, DIRS.right, later());
    expect(s.a).toMatchObject({ kind: 'blocked', dur: DURATION.blocked });
    expect(s.msg).toBe('blocked');
    expect(settle(s)).toMatchObject({ moves: 0, msg: 'blocked', a: null });
  });

  it('nach „blocked“ bringt die nächste Aktion das Intro zurück (bewusst anders als im Entwurf)', () => {
    const B = deepFreeze(newGame(parseLevel('#######\n# @$$.#\n#    .#\n#######')));
    const s = settle(key(B, DIRS.right, later()));
    expect(s.msg).toBe('blocked');
    expect(settle(act(s, [DIRS.down], later()))).toMatchObject({ msg: 'intro', moves: 1 });
  });

  it('merkt sich während einer Animation bis zu zwei Tasten, jede mit Schnappschuss', () => {
    const t = later();
    let s = key(gameOf(1), DIRS.left, t);
    expect(s.a).toMatchObject({ kind: 'walk', t0: t, dur: DURATION.walk, n: 1 });
    s = key(deepFreeze(s), DIRS.left, t + 10);
    s = key(deepFreeze(s), DIRS.left, t + 20);
    expect(s.q).toHaveLength(2);
    expect(s.hist).toHaveLength(3);
    const full = key(deepFreeze(s), DIRS.left, t + 30);
    expect(full).toBe(s);
    expect(tick(deepFreeze(s), t + 50)).toBe(s);
    const done = settle(s);
    expect(done.moves).toBe(3);
    expect(done.a).toBeNull();
  });

  it('bump leert den Puffer', () => {
    const s = act(gameOf(1), [DIRS.down, DIRS.left], later());
    expect(s.a).toMatchObject({ kind: 'bump', dur: DURATION.bump });
    expect(s).toMatchObject({ q: [], moves: 0 });
  });

  it('weniger Bewegung: jede Animation 1 ms', () => {
    const s = key(gameOf(1, true), DIRS.left, later());
    expect(s.a?.dur).toBe(1);
    expect(duration(gameOf(1), 'push')).toBe(170);
  });

  it('eine leere Aktion hebt nur die Auswahl auf', () => {
    const s = act(deepFreeze({ ...gameOf(2), sel: 0 }), [], later());
    expect(s).toMatchObject({ sel: null, hint: null, hist: [] });
  });

  it('Zug zurück bewahrt höchstens 500 Schnappschüsse', () => {
    let s = gameOf(1);
    for (let i = 0; i < UNDO_LIMIT + 10; i++) s = press(s, i % 2 ? 'r' : 'l');
    expect(s.hist).toHaveLength(UNDO_LIMIT);
    expect(s.hist[0]!.moves).toBe(10);
  });
});

describe('Sieg', () => {
  it('erkennt den Sieg mit der gespeicherten Lösung: Meldung, Konfetti, Züge', () => {
    const s = press(gameOf(1), lesson(1).sol!);
    expect(s).toMatchObject({ won: true, moves: 9, pushes: 4, msg: 'win', confetti: true, shownWin: false });
    expect(msgKind(s.msg)).toBe('win');
  });

  it('nach dem Sieg zählen keine Tasten, Aktionen und Tipps mehr', () => {
    const s = press(gameOf(1), lesson(1).sol!);
    expect(key(s, DIRS.right, later())).toBe(s);
    expect(act(s, [DIRS.right], later())).toBe(s);
    expect(tip(s)).toBe(s);
  });

  it('Zug zurück nach dem Sieg nimmt den Sieg zurück', () => {
    const s = undo(press(gameOf(1), lesson(1).sol!));
    expect(s).toMatchObject({ won: false, moves: 8, pushes: 3, msg: 'intro', confetti: false, a: null, q: [] });
  });

  it('Zug zurück vor einen Sieg zeigt den Sieg-Text wieder', () => {
    const won = press(gameOf(1), lesson(1).sol!);
    const back = undo(deepFreeze(restart(won)));
    expect(back).toMatchObject({ won: true, msg: 'win' });
  });

  it('„Nochmal“ startet neu und leert den Verlauf', () => {
    const s = again(press(gameOf(1), lesson(1).sol!));
    expect(s).toMatchObject({ won: false, moves: 0, pushes: 0, hist: [], msg: 'intro', setbacks: 0, p: gameOf(1).p });
    expect(again(gameOf(1))).toMatchObject({ hist: [], msg: 'intro', moves: 0 });
  });
});

describe('Zug zurück und Neustart', () => {
  it('Zug zurück am Anfang meldet „Ganz am Anfang“', () => {
    expect(undo(gameOf(1))).toMatchObject({ msg: 'atStart', moves: 0 });
  });

  it('Neustart ist rücknehmbar und zählt als Rückschlag', () => {
    const played = press(gameOf(1), 'rr');
    const r = deepFreeze(restart(played));
    expect(r).toMatchObject({ moves: 0, p: gameOf(1).p, dir: 'j', msg: 'restarted', setbacks: 1 });
    expect(undo(r)).toMatchObject({ moves: 2, p: played.p, msg: 'intro' });
  });

  it('Neustart bei 0 Zügen tut nichts außer dem Intro', () => {
    const g = deepFreeze({ ...gameOf(1), msg: 'atStart' as const });
    const r = restart(g);
    expect(r).toMatchObject({ msg: 'intro', setbacks: 0, hist: [], moves: 0 });
    expect(restart(g, true)).toBe(g);
  });

  it('Zug zurück leert Animation, Puffer, Auswahl, Tipp und Konfetti', () => {
    const t = later();
    let s = deepFreeze(tip(gameOf(2)));
    s = deepFreeze(key(s, DIRS.left, t));
    s = deepFreeze(key(s, DIRS.left, t + 1));
    expect(s.a).not.toBeNull();
    const u = undo(s);
    expect(u).toMatchObject({ a: null, q: [], sel: null, hint: null, confetti: false });
  });

  it('Zug zurück bestimmt festsitzende Kisten neu', () => {
    const stuck = press(gameOf(4), 'u');
    expect(stuck.stuck).toEqual([0]);
    const walked = press(stuck, 'd');
    expect(walked.msg).toBe('stuck');
    const back = undo(walked);
    expect(back).toMatchObject({ stuck: [0], msg: 'stuck' });
    expect(undo(back)).toMatchObject({ stuck: [], msg: 'intro', moves: 0 });
  });
});

describe('Prüfung nach jedem Schub', () => {
  it('Kiste in der toten Ecke: festsitzend, Warnung, Rückschlag', () => {
    const s = press(gameOf(4), 'u');
    expect(s).toMatchObject({ stuck: [0], msg: 'stuck', setbacks: 1, q: [] });
    expect(msgKind(s.msg)).toBe('warn');
  });

  it('festsitzende Kiste an der Wand weitergeschoben: steht nur einmal in stuck', () => {
    const s = press(gameOf(4), 'ulur');
    expect(s.boxes).toEqual([s.L.W + 4]);
    expect(s.stuck).toEqual([0]);
    expect(s.msg).toBe('stuck');
  });

  it('unlösbar nach dem Schub (Löser null): Warnung „So geht es nicht mehr auf“, Rückschlag', () => {
    const s = press(gameOf(15), 'dr');
    expect(s).toMatchObject({ msg: 'unsolvable', setbacks: 1, stuck: [] });
    expect(msgKind(s.msg)).toBe('warn');
  });

  it('Kiste auf dem Ziel ohne Sieg: „Die Kiste steht.“, die nächste Aktion zeigt wieder das Intro', () => {
    const s = press(gameOf(3), 'uldluu');
    expect(s).toMatchObject({ msg: 'placed', won: false });
    expect(press(s, 'd').msg).toBe('intro');
  });

  it('nach einer Warnung bleibt sie bei der nächsten Aktion stehen', () => {
    const s = press(gameOf(15), 'dr');
    expect(press(s, 'l').msg).toBe('unsolvable');
  });

  it('festsitzende Kiste bricht den Puffer ab', () => {
    const t = later();
    let s = key(gameOf(4), DIRS.up, t);
    s = key(deepFreeze(s), DIRS.down, t + 1);
    s = tick(deepFreeze(s), t + 1000);
    expect(s).toMatchObject({ msg: 'stuck', q: [], a: null });
  });

  it('der dritte Rückschlag bietet das Überspringen genau einmal an', () => {
    let s = gameOf(1);
    const offers: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      s = deepFreeze(restart(press(s, 'r')));
      offers.push(s.offered);
    }
    expect(s.setbacks).toBe(5);
    expect(offers).toEqual([false, false, true, true, true]);
  });

  it('Rückschläge aus Sackgassen zählen mit', () => {
    let s = press(gameOf(4), 'u');
    s = press(undo(s), 'u');
    expect(s.offered).toBe(false);
    s = press(undo(s), 'u');
    expect(s).toMatchObject({ setbacks: 3, offered: true });
  });
});

describe('Tipp', () => {
  it('auf dem Start: Kiste und Richtung wie solve()', () => {
    const g = gameOf(3);
    const r = solve(g.L, g.boxes, g.p);
    if (!r || !('box' in r)) throw new Error('Startstellung muss lösbar sein');
    expect(tip(g)).toMatchObject({ sel: r.box, hint: { box: r.box, d: dirKey(r.d) }, msg: 'tip' });
  });

  it('unlösbar: Warnung; zu verzwickt: eigener Text; schon gelöst: nichts', () => {
    expect(tip(press(gameOf(15), 'dr')).msg).toBe('tipDead');
    expect(tip(gameOf(15), 1)).toMatchObject({ msg: 'tipHard', sel: null });
    const solved = deepFreeze({ ...gameOf(1), boxes: [...gameOf(1).L.goals] });
    expect(tip(solved)).toBe(solved);
  });

  it('während einer Animation kein Tipp', () => {
    const s = deepFreeze(key(gameOf(2), DIRS.left, later()));
    expect(tip(s)).toBe(s);
  });

  it('Kiste antippen schaltet die Auswahl; der Tipp bleibt nur für dieselbe Kiste', () => {
    const tipped = deepFreeze(tip(gameOf(3)));
    const box = tipped.sel!;
    const off = deepFreeze(toggleSelect(tipped, box));
    expect(off).toMatchObject({ sel: null, hint: null });
    const other = toggleSelect(tipped, box === 0 ? 1 : 0);
    expect(other.hint).toBeNull();
    const reselected = toggleSelect(deepFreeze({ ...tipped, sel: null }), box);
    expect(reselected).toMatchObject({ sel: box, hint: tipped.hint });
  });

  it('Kiste ohne Möglichkeit: Meldung „nirgendwohin“', () => {
    const corner = deepFreeze(newGame(parseLevel('#####\n#$ .#\n#@  #\n#####')));
    expect(toggleSelect(corner, 0)).toMatchObject({ sel: 0, msg: 'noOptions' });
    expect(toggleSelect(gameOf(1), 0)).toMatchObject({ sel: 0, msg: 'intro' });
  });
});

describe('Schieben über den Pfeil', () => {
  it('Laufweg und Schub sind eine Aktion', () => {
    const g = gameOf(1);
    const d = options(g, 0);
    expect(d).toContain(DIRS.left);
    const s = pushVia(g, 0, DIRS.left, later());
    expect(s?.hist).toHaveLength(1);
    const done = settle(s!);
    expect(done).toMatchObject({ moves: 6, pushes: 1 });
    expect(undo(done).moves).toBe(0);
  });

  it('null, wenn die Figur nicht hinter die Kiste kommt oder die Kiste fehlt', () => {
    const g = gameOf(1);
    expect(options(g, 0)).not.toContain(DIRS.up);
    expect(pushVia(g, 0, DIRS.up, later())).toBeNull();
    expect(pushVia(g, 9, DIRS.left, later())).toBeNull();
    expect(options(g, 9)).toEqual([]);
  });
});

describe('Lösung zeigen', () => {
  it('vom Start die gespeicherte Lösung als eine Aktion bis zum vorgespielten Sieg', () => {
    const s = deepFreeze(showSolution(gameOf(1), later()));
    expect(s).toMatchObject({ auto: true, solutionShown: true, msg: 'showing', hist: [{ moves: 0 }] });
    expect(s.a?.dur).toBe(DURATION.walk * AUTO_SLOWER);
    const done = settle(s);
    expect(done).toMatchObject({ won: true, shownWin: true, auto: false, confetti: false, msg: 'shownWin', moves: 9 });
    expect(done.hist).toHaveLength(1);
  });

  it('mitten in der Lektion: Schub für Schub mit dem Löser, je Schub ein Schnappschuss', () => {
    const s = showSolution(press(gameOf(2), 'u'), later());
    expect(s).toMatchObject({ auto: true, a: null, moves: 1 });
    const done = settle(s);
    expect(done).toMatchObject({ won: true, shownWin: true });
    expect(done.hist).toHaveLength(1 + done.pushes);
  });

  it('aus einer Sackgasse und nach einem Sieg erst still zurück auf den Start', () => {
    const dead = deepFreeze(showSolution(press(gameOf(4), 'u'), later()));
    expect(dead).toMatchObject({ auto: true, stuck: [], setbacks: 1 });
    expect(dead).toMatchObject({ moves: 0, p: gameOf(4).p, boxes: gameOf(4).boxes });
    expect(dead.hist.at(-1)?.moves).toBe(1);
    expect(settle(dead)).toMatchObject({ won: true, shownWin: true });
    const won = deepFreeze(showSolution(press(gameOf(1), lesson(1).sol!), later()));
    expect(won).toMatchObject({ won: false, auto: true });
    expect(settle(won).shownWin).toBe(true);
  });

  it('jede Taste beendet das Vorspielen mit dem Intro', () => {
    const s = deepFreeze(showSolution(gameOf(3), later()));
    const k = key(s, DIRS.up, later());
    expect(k).toMatchObject({ auto: false, msg: 'intro' });
    const idle = gameOf(3);
    expect(stopAuto(idle)).toBe(idle);
    expect(undo(s)).toMatchObject({ auto: false, moves: 0 });
    expect(restart(s)).toMatchObject({ auto: false });
    expect(tip(deepFreeze({ ...s, a: null }))).toMatchObject({ auto: false });
  });

  it('endet still mit dem Intro, wenn der Löser nicht weiterkommt', () => {
    const stuck = deepFreeze({ ...press(gameOf(15), 'dr'), auto: true, msg: 'showing' as const });
    expect(tick(stuck, later())).toMatchObject({ auto: false, msg: 'intro' });
  });
});

describe('Reinheit', () => {
  it('keine Funktion verändert ihren (eingefrorenen) Eingabezustand', () => {
    const base = deepFreeze(press(gameOf(3), 'uld'));
    const before = JSON.stringify(base);
    const moving = deepFreeze(key(base, DIRS.left, later()));
    const results = [
      step(base, DIRS.up),
      step(base, DIRS.left),
      key(base, DIRS.up, later()),
      key(moving, DIRS.up, later()),
      act(base, dirs('ur'), later()),
      tick(moving, later()),
      undo(base),
      restart(base),
      restart(base, true),
      again(base),
      tip(base),
      toggleSelect(base, 1),
      pushVia(base, 0, DIRS.up, later()),
      showSolution(base, later()),
      stopAuto(deepFreeze({ ...base, auto: true })),
    ];
    expect(results.every((r) => r !== null)).toBe(true);
    expect(JSON.stringify(base)).toBe(before);
  });
});
