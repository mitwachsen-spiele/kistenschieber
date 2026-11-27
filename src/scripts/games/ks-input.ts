// Eingabe im Spiel, rein und getestet: welche Taste was bedeutet (wie im Entwurf). Pfeile und WASD laufen, Z und
// Backspace nehmen einen Zug zurück, R startet neu, H gibt einen Tipp, M öffnet das Menü, Esc hebt die Auswahl auf
// (sonst Menü), Enter geht nach dem Sieg weiter. Ignoriert werden Tasten bei offenem Dialog, in Formularfeldern und mit
// Alt, Strg oder Meta (Tastenkürzel des Browsers). Dazu Zeiger und Steuerkreuz: Ein kurzer Weg ist ein Tippen, ein
// langer (über 28 px) ein Wisch in die Gitterrichtung, deren Bildschirmrichtung am besten passt; die Pfeile des
// Steuerkreuzes zeigen in dieselbe Bildschirmrichtung.
import type { ScreenDir } from '../../lib/games/oblique/camera';
import type { Picked } from '../../lib/games/oblique/geometry';
import { type DirKey, nb } from '../../lib/games/sokoban/level';
import { findPath } from '../../lib/games/sokoban/solver';
import { type Game, act, boxSet, options, pushVia, stopAuto, toggleSelect } from '../../lib/games/sokoban/state';

type Simple = 'undo' | 'restart' | 'tip' | 'menu' | 'escape' | 'next' | 'other';

export type KeyAction = { readonly kind: 'step'; readonly d: DirKey } | { readonly kind: Simple };

/** Was von einem keydown gebraucht wird */
export interface KeyInfo {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  /** Fokus in input, select oder textarea */
  readonly inField: boolean;
  /** Fokus auf einem Knopf oder Link: Enter löst den aus, nicht „weiter“ */
  readonly onControl: boolean;
  readonly dialogOpen: boolean;
}

const STEP: Readonly<Record<string, DirKey>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

const SIMPLE: Readonly<Record<string, Simple>> = {
  z: 'undo',
  Z: 'undo',
  Backspace: 'undo',
  r: 'restart',
  R: 'restart',
  h: 'tip',
  H: 'tip',
  m: 'menu',
  M: 'menu',
  Escape: 'escape',
};

/** Bedeutung einer Taste im Spiel; null = nicht fürs Spiel. `won`: Enter geht nur nach dem Sieg weiter */
export function keyAction(k: KeyInfo, won: boolean): KeyAction | null {
  if (k.dialogOpen || k.inField || k.altKey || k.ctrlKey || k.metaKey) return null;
  const d = STEP[k.key];
  if (d) return { kind: 'step', d };
  const kind = SIMPLE[k.key];
  if (kind) return { kind };
  if (k.key === 'Enter' && won && !k.onControl) return { kind: 'next' };
  return { kind: 'other' };
}

/** Diese Tasten tun sonst etwas im Browser (Seite scrollen, zurück): das Spiel behält sie für sich */
export const keepsKey = (a: KeyAction): boolean => a.kind === 'step' || a.kind === 'undo' || a.kind === 'escape';

/** Ab so viel Weg (CSS-px) zwischen Drücken und Loslassen ist es ein Wisch, kein Tippen */
export const SWIPE_PX = 28;

/** Wischrichtung: die Gitterrichtung, deren Bildschirmrichtung am besten zum Weg passt; null = Tippen */
export function swipeDir(dx: number, dy: number, dirs: readonly ScreenDir[]): DirKey | null {
  const l = Math.hypot(dx, dy);
  if (l <= SWIPE_PX) return null;
  let best: ScreenDir | null = null;
  for (const s of dirs) if (!best || s.x * dx + s.y * dy > best.x * dx + best.y * dy) best = s;
  return best?.name ?? null;
}

/** Drehung (Grad) der Pfeile im Steuerkreuz: der Pfeil zeigt nach oben, gedreht auf die Bildschirmrichtung */
export function padAngles(dirs: readonly ScreenDir[]): Record<DirKey, number> {
  const out: Record<DirKey, number> = { up: 0, down: 180, left: -90, right: 90 };
  for (const s of dirs) out[s.name] = Number(((Math.atan2(s.y, s.x) * 180) / Math.PI + 90).toFixed(1));
  return out;
}

/**
 * Tippen aufs Feld (wie im Entwurf): beendet nur das Vorspielen; während einer Animation und nach dem Sieg nichts.
 * Daneben hebt die Auswahl auf. Eine Kiste schaltet ihre Auswahl um. Boden oder Figur: Ist es das Pfeilfeld der
 * gewählten Kiste, läuft die Figur hin und schiebt; sonst läuft sie als eine Aktion dorthin. Unerreichbar hebt die
 * Auswahl auf
 */
export function tapAt(g: Game, hit: Picked | null, now: number): Game {
  if (g.auto) return stopAuto(g);
  if (g.a || g.won) return g;
  const clear = (): Game => (g.sel === null && g.hint === null ? g : { ...g, sel: null, hint: null });
  if (!hit) return clear();
  if (hit.type === 'crate') return toggleSelect(g, hit.id);
  const k = hit.type === 'fig' ? g.p : hit.r * g.L.W + hit.c;
  if (g.sel !== null) {
    const box = g.boxes[g.sel];
    const d = box === undefined ? undefined : options(g, g.sel).find((o) => nb(g.L, box, o) === k);
    if (d) return pushVia(g, g.sel, d, now) ?? g;
  }
  const path = findPath(g.L, boxSet(g), g.p, k);
  return path ? act(g, path, now) : clear();
}
