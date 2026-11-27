// Spielzustand einer Lektion als reiner Reducer: Schritte und Schübe, Eingabepuffer, Zug zurück, Neustart, Sieg,
// Prüfung nach jedem Schub, Rückschläge, Tipp und „Lösung zeigen“. Keine Funktion verändert ihre Eingabe, jede gibt
// einen neuen Zustand zurück. Die Zeit kommt als Parameter (now in ms), Meldungen sind Schlüssel (Texte in
// data/games/texts.ts). Speichern (Bestwert, „mit Lösung gesehen“) und Konfetti-Teilchen macht der Aufrufer.
import { D4, type Dir, type DirKey, type Facing, type Level, dirName, nb, opposite, parseLurd } from './level';
import { CHECK_CAP, SOLVE_CAP, findPath, reach, solve } from './solver';

/** Schnappschüsse für „Zug zurück“; der älteste fällt weg */
export const UNDO_LIMIT = 500;
/** Tastendrücke, die während einer Animation vorgemerkt werden */
export const BUFFER = 2;
/** Ab so vielen Rückschlägen bietet das Spiel das Überspringen an */
export const SETBACKS_FOR_OFFER = 3;
/** Dauer der Animation je Art in ms */
export const DURATION = { push: 170, walk: 120, bump: 160, blocked: 160 } as const;
/** „Lösung zeigen“ spielt langsamer vor */
export const AUTO_SLOWER = 1.3;

export type MsgKey =
  | 'intro'
  | 'blocked'
  | 'stuck'
  | 'unsolvable'
  | 'placed'
  | 'atStart'
  | 'restarted'
  | 'tipDead'
  | 'tipHard'
  | 'tip'
  | 'noOptions'
  | 'showing'
  | 'win'
  | 'shownWin';

/** Art des Schilds: normal, Warnung oder Sieg */
export type MsgKind = '' | 'warn' | 'win';

const WARN: ReadonlySet<MsgKey> = new Set<MsgKey>(['stuck', 'unsolvable', 'tipDead']);

export function msgKind(key: MsgKey): MsgKind {
  if (WARN.has(key)) return 'warn';
  return key === 'win' || key === 'shownWin' ? 'win' : '';
}

/** Ergebnis eines Schritts; Felder als Gitter-Index */
export type Move =
  | { readonly kind: 'walk'; readonly from: number; readonly to: number }
  | {
      readonly kind: 'push';
      readonly from: number;
      readonly to: number;
      readonly box: number;
      readonly bfrom: number;
      readonly bto: number;
    }
  | { readonly kind: 'bump' | 'blocked' };

/** Laufende Animation: der Schritt samt Start, Dauer und laufender Nummer (Schrittbein) */
export type Anim = Move & { readonly t0: number; readonly dur: number; readonly n: number };

/** Was ein Schnappschuss für „Zug zurück“ festhält */
export interface Pose {
  readonly p: number;
  /** Kistenfelder; der Index ist die Kisten-ID */
  readonly boxes: readonly number[];
  readonly dir: Facing;
  readonly moves: number;
  readonly pushes: number;
  readonly won: boolean;
}

/** Tipp: Kiste und Richtung (als Name, nicht als Array-Identität) */
export interface Hint {
  readonly box: number;
  readonly d: DirKey;
}

export interface Game extends Pose {
  readonly L: Level;
  /** gespeicherte zugkürzeste Lösung (LURD) für „Lösung zeigen“ vom Start */
  readonly sol: string | null;
  /** weniger Bewegung: jede Animation 1 ms */
  readonly reduce: boolean;
  readonly hist: readonly Pose[];
  /** vorgemerkte Schritte */
  readonly q: readonly Dir[];
  readonly a: Anim | null;
  readonly n: number;
  readonly sel: number | null;
  readonly hint: Hint | null;
  /** Kisten, die festsitzen (nicht auf Ziel, nicht live) */
  readonly stuck: readonly number[];
  /** eigener Sieg: Konfetti darf fliegen; Zug zurück und Neustart nehmen es weg */
  readonly confetti: boolean;
  /** „Lösung zeigen“ spielt gerade vor */
  readonly auto: boolean;
  /** der Sieg wurde vorgespielt: kein Bestwert, kein Konfetti */
  readonly shownWin: boolean;
  /** „Lösung zeigen“ wurde in diesem Aufruf benutzt; der Fortschritt merkt es sofort */
  readonly solutionShown: boolean;
  readonly setbacks: number;
  /** „Zu knifflig? Überspringen“ wird angeboten */
  readonly offered: boolean;
  readonly msg: MsgKey;
}

const startPose = (L: Level): Pose => ({ p: L.player, boxes: L.boxes, dir: 'j', moves: 0, pushes: 0, won: false });

export function newGame(L: Level, opts: { readonly sol?: string; readonly reduce?: boolean } = {}): Game {
  return {
    L,
    sol: opts.sol ?? null,
    reduce: opts.reduce ?? false,
    ...startPose(L),
    hist: [],
    q: [],
    a: null,
    n: 0,
    sel: null,
    hint: null,
    stuck: [],
    confetti: false,
    auto: false,
    shownWin: false,
    solutionShown: false,
    setbacks: 0,
    offered: false,
    msg: 'intro',
  };
}

/** Name einer Richtung */
export function dirKey([dr, dc]: Dir): DirKey {
  if (dr < 0) return 'up';
  if (dr > 0) return 'down';
  return dc < 0 ? 'left' : 'right';
}

export const boxSet = (g: Pose): Set<number> => new Set(g.boxes);

/** Läuft noch etwas (Animation, Puffer, Vorspielen)? Dann braucht es weitere Takte */
export const busy = (g: Game): boolean => g.a !== null || g.q.length > 0 || (g.auto && !g.won);

/** Richtungen, in die Kiste id jetzt geschoben werden kann: Zielfeld frei, Schiebeposition erreichbar */
export function options(g: Game, id: number): Dir[] {
  const L = g.L;
  const k = g.boxes[id];
  if (k === undefined) return [];
  const set = boxSet(g);
  const R = reach(L, set, g.p);
  return D4.filter((d) => {
    const to = nb(L, k, d);
    const from = nb(L, k, opposite(d));
    return to >= 0 && from >= 0 && L.inside.has(to) && !set.has(to) && R.has(from);
  });
}

/**
 * Richtungen der Pfeile an Kiste id: alle erlaubten (options); gilt der Tipp dieser Kiste, nur seine eine Richtung
 * (über den Namen verglichen). Zeichnen (scene.ts) und Antippen (ks-input.ts) nutzen dieselbe Liste, damit kein
 * verborgener Pfeil schiebt
 */
export function arrowDirs(g: Game, id: number): Dir[] {
  const all = options(g, id);
  const h = g.hint?.box === id ? g.hint.d : null;
  return h === null ? all : all.filter((d) => dirKey(d) === h);
}

/** Ein Schritt ohne Animation: laufen, schieben, gegen die Wand (bump) oder Kiste ohne Platz dahinter (blocked) */
export function step(g: Game, d: Dir): { readonly game: Game; readonly move: Move } {
  const L = g.L;
  const dir = dirName(d[0], d[1]);
  const k = nb(L, g.p, d);
  if (k < 0 || !L.inside.has(k)) return { game: { ...g, dir }, move: { kind: 'bump' } };
  const box = g.boxes.indexOf(k);
  if (box < 0) return { game: { ...g, dir, p: k, moves: g.moves + 1 }, move: { kind: 'walk', from: g.p, to: k } };
  const t = nb(L, k, d);
  if (t < 0 || !L.inside.has(t) || g.boxes.includes(t)) return { game: { ...g, dir }, move: { kind: 'blocked' } };
  const boxes = g.boxes.slice();
  boxes[box] = t;
  return {
    game: { ...g, dir, boxes, p: k, moves: g.moves + 1, pushes: g.pushes + 1 },
    move: { kind: 'push', from: g.p, to: k, box, bfrom: k, bto: t },
  };
}

/** Dauer einer Animation: beim Vorspielen ×1,3, bei weniger Bewegung 1 ms */
export function duration(g: Game, kind: Move['kind']): number {
  return g.reduce ? 1 : DURATION[kind] * (g.auto ? AUTO_SLOWER : 1);
}

function withSnapshot(g: Game): Game {
  const snap: Pose = { p: g.p, boxes: g.boxes, dir: g.dir, moves: g.moves, pushes: g.pushes, won: g.won };
  const hist = [...g.hist, snap];
  return { ...g, hist: hist.length > UNDO_LIMIT ? hist.slice(-UNDO_LIMIT) : hist };
}

function setback(g: Game): Game {
  const setbacks = g.setbacks + 1;
  return { ...g, setbacks, offered: g.offered || (setbacks >= SETBACKS_FOR_OFFER && !g.won) };
}

const stopped = (g: Game): Game => (g.auto ? { ...g, auto: false, q: [], msg: 'intro' } : g);

/** Nächsten vorgemerkten Schritt starten; bump und blocked leeren den Puffer */
function startNext(g: Game, now: number): Game {
  const [d, ...rest] = g.q;
  if (!d) return g;
  const { game, move } = step({ ...g, q: rest }, d);
  const n = g.n + 1;
  const next: Game = { ...game, n, a: { ...move, t0: now, dur: duration(game, move.kind), n } };
  if (move.kind === 'bump') return { ...next, q: [] };
  return move.kind === 'blocked' ? { ...next, q: [], msg: 'blocked' } : next;
}

function win(g: Game): Game {
  const shownWin = g.auto;
  return { ...g, won: true, q: [], shownWin, auto: false, confetti: !shownWin, msg: shownWin ? 'shownWin' : 'win' };
}

/** Nach jedem Schub: Sieg vor festsitzender Kiste vor „geht nicht mehr auf“ (Löser bis CHECK_CAP) */
function afterPush(g: Game, id: number, k: number): Game {
  const L = g.L;
  if (g.boxes.every((b) => L.goals.has(b))) return win(g);
  if (g.auto) return g;
  if (!L.goals.has(k) && !L.live.has(k))
    return setback({ ...g, stuck: g.stuck.includes(id) ? g.stuck : [...g.stuck, id], q: [], msg: 'stuck' });
  if (solve(L, g.boxes, g.p, CHECK_CAP) === null) return setback({ ...g, q: [], msg: 'unsolvable' });
  return L.goals.has(k) ? { ...g, msg: 'placed' } : g;
}

/** Eine Aktion (ein Schnappschuss): ein Tastendruck, ein ganzer Laufweg samt Schub oder die gespeicherte Lösung */
export function act(g: Game, steps: readonly Dir[], now: number): Game {
  if (g.won) return g;
  let s: Game = { ...g, sel: null, hint: null };
  if (!steps.length) return s;
  s = { ...withSnapshot(s), q: steps };
  // Nach jeder neuen Aktion wieder das Intro, außer beim Vorspielen, bei festsitzender Kiste oder nach einer Warnung.
  // Vor dem ersten Schritt gesetzt, damit „Dahinter ist kein Platz“ sichtbar bleibt
  if (!s.auto && !s.stuck.length && msgKind(s.msg) !== 'warn') s = { ...s, msg: 'intro' };
  return s.a ? s : startNext(s, now);
}

/** Tastendruck: während einer Animation bis zu BUFFER Schritte vormerken (je ein Schnappschuss), sonst eine Aktion */
export function key(g: Game, d: Dir, now: number): Game {
  if (g.won) return g;
  const s = stopped(g);
  if (!s.a) return act(s, [d], now);
  return s.q.length < BUFFER ? { ...withSnapshot(s), sel: null, hint: null, q: [...s.q, d] } : s;
}

/** Ein Takt: fertige Animation abschließen (nach einem Schub prüfen), nächsten Schritt starten, beim Vorspielen weiter */
export function tick(g: Game, now: number): Game {
  let s = g;
  const A = s.a;
  if (A && now - A.t0 >= A.dur) {
    s = { ...s, a: null };
    if (A.kind === 'push') s = afterPush(s, A.box, A.bto);
    if (!s.won) s = startNext(s, now);
  }
  return !s.a && !s.q.length && s.auto && !s.won ? autoStep(s, now) : s;
}

/** „Zug zurück“: letzten Schnappschuss wiederherstellen, alles Laufende leeren, festsitzende Kisten neu bestimmen */
export function undo(g: Game): Game {
  const s = stopped(g);
  const last = s.hist.at(-1);
  if (!last) return { ...s, msg: 'atStart' };
  const L = s.L;
  const stuck = last.boxes.flatMap((k, id) => (!L.goals.has(k) && !L.live.has(k) ? [id] : []));
  const r: Game = {
    ...s,
    ...last,
    hist: s.hist.slice(0, -1),
    a: null,
    q: [],
    sel: null,
    hint: null,
    confetti: false,
    stuck,
  };
  return { ...r, msg: r.won ? winKey(r) : stuck.length ? 'stuck' : 'intro' };
}

const winKey = (g: Game): MsgKey => (g.shownWin ? 'shownWin' : 'win');

/**
 * Neustart: nichts zu tun bei 0 Zügen ohne Sieg. Sonst ein Schnappschuss (rücknehmbar) und die Startstellung; laut
 * (nicht quiet) zählt er als Rückschlag und meldet sich
 */
export function restart(g: Game, quiet = false): Game {
  const s = quiet ? g : stopped(g);
  if (!s.moves && !s.won) return quiet ? s : { ...s, msg: 'intro' };
  const r: Game = {
    ...withSnapshot(s),
    ...startPose(s.L),
    shownWin: false,
    a: null,
    q: [],
    sel: null,
    hint: null,
    confetti: false,
    stuck: [],
  };
  return quiet ? r : setback({ ...r, msg: 'restarted' });
}

/** „Nochmal“ nach dem Sieg: still neu starten, Verlauf leeren, Intro */
export function again(g: Game): Game {
  return { ...restart(g, true), hist: [], msg: 'intro' };
}

/** Tipp: erster Schub einer schubkürzesten Lösung als Auswahl und türkiser Pfeil */
export function tip(g: Game, cap = SOLVE_CAP): Game {
  if (g.won) return g;
  const s = stopped(g);
  if (s.a) return s;
  const r = solve(s.L, s.boxes, s.p, cap);
  if (!r) return { ...s, msg: 'tipDead' };
  if ('unknown' in r) return { ...s, msg: 'tipHard' };
  if ('done' in r) return s;
  return { ...s, sel: r.box, hint: { box: r.box, d: dirKey(r.d) }, msg: 'tip' };
}

/** Kiste antippen: Auswahl umschalten; der Tipp bleibt nur für dieselbe Kiste. Ohne Möglichkeit eine Meldung */
export function toggleSelect(g: Game, id: number): Game {
  const sel = g.sel === id ? null : id;
  const s: Game = { ...g, sel, hint: g.hint && g.hint.box === sel ? g.hint : null };
  return sel !== null && !options(s, sel).length ? { ...s, msg: 'noOptions' } : s;
}

/** Laufweg zur Schiebeposition samt Schub als eine Aktion; null, wenn die Figur nicht hinkommt */
export function pushVia(g: Game, id: number, d: Dir, now: number): Game | null {
  const k = g.boxes[id];
  if (k === undefined) return null;
  const path = findPath(g.L, boxSet(g), g.p, nb(g.L, k, opposite(d)));
  return path ? act(g, [...path, d], now) : null;
}

/** Vorspielen Schub für Schub mit dem Löser; geht es nicht weiter, endet das Vorspielen mit dem Intro */
function autoStep(g: Game, now: number): Game {
  const r = solve(g.L, g.boxes, g.p);
  const next = r && 'box' in r ? pushVia(g, r.box, r.d, now) : null;
  return next ?? { ...g, auto: false, msg: 'intro' };
}

/**
 * „Lösung zeigen“: nach einem Sieg oder aus einer Sackgasse erst still auf den Start. Vom Start die gespeicherte
 * zugkürzeste Lösung als eine Aktion, sonst Schub für Schub (tick). Jede Eingabe beendet das Vorspielen
 */
export function showSolution(g: Game, now: number, cap = SOLVE_CAP): Game {
  let s = g.won ? restart(g, true) : g;
  const r = solve(s.L, s.boxes, s.p, cap);
  if (!r || 'unknown' in r) s = restart(s, true);
  s = { ...s, a: null, q: [], sel: null, hint: null, stuck: [], auto: true, solutionShown: true, msg: 'showing' };
  return s.moves === 0 && s.sol
    ? act(
        s,
        parseLurd(s.sol).map((x) => x.dir),
        now,
      )
    : s;
}

/** Vorspielen abbrechen (Taste, Tippen, Wischen, Menü): Puffer leeren, Intro */
export const stopAuto = stopped;
