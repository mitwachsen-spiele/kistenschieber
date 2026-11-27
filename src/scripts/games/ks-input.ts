// Eingabe im Spiel, rein und getestet: welche Taste was bedeutet (wie im Entwurf). Pfeile und WASD laufen, Z und
// Backspace nehmen einen Zug zurück, R startet neu, H gibt einen Tipp, M öffnet das Menü, Esc hebt die Auswahl auf
// (sonst Menü), Enter geht nach dem Sieg weiter. Ignoriert werden Tasten bei offenem Dialog, in Formularfeldern und mit
// Alt, Strg oder Meta (Tastenkürzel des Browsers). Dazu Zeiger und Steuerkreuz: Ein kurzer Weg ist ein Tippen, ein
// langer (über 28 px) tut nichts – Wischen ist kein Schritt (Issue #12), der Finger darf die Seite scrollen. Die Pfeile
// des Steuerkreuzes zeigen in die Bildschirmrichtung der Gitterrichtung.
import type { ScreenDir } from '../../lib/games/oblique/camera';
import type { Picked } from '../../lib/games/oblique/geometry';
import { type DirKey, nb } from '../../lib/games/sokoban/level';
import { findPath } from '../../lib/games/sokoban/solver';
import { type Game, act, arrowDirs, boxSet, pushVia, stopAuto, toggleSelect } from '../../lib/games/sokoban/state';

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

/** Bis zu so viel Weg (CSS-px) zwischen Drücken und Loslassen ist es ein Tippen; mehr ist ein Wisch und tut nichts */
export const TAP_PX = 28;

/** Ein Tippen (kurzer Weg) oder ein Wisch (langer Weg, kein Schritt: Wischen scrollt höchstens die Seite) */
export const isTap = (dx: number, dy: number): boolean => Math.hypot(dx, dy) <= TAP_PX;

/** Drehung (Grad) der Pfeile im Steuerkreuz: der Pfeil zeigt nach oben, gedreht auf die Bildschirmrichtung */
export function padAngles(dirs: readonly ScreenDir[]): Record<DirKey, number> {
  const out: Record<DirKey, number> = { up: 0, down: 180, left: -90, right: 90 };
  for (const s of dirs) out[s.name] = Number(((Math.atan2(s.y, s.x) * 180) / Math.PI + 90).toFixed(1));
  return out;
}

/**
 * Tippen aufs Feld (wie im Entwurf): beendet nur das Vorspielen; während einer Animation und nach dem Sieg nichts.
 * Daneben hebt die Auswahl auf. Eine Kiste schaltet ihre Auswahl um. Boden oder Figur: Ist es ein gezeigtes Pfeilfeld
 * der gewählten Kiste (mit Tipp nur dessen eines, arrowDirs), läuft die Figur hin und schiebt; sonst läuft sie als eine Aktion dorthin. Unerreichbar hebt die
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
    const d = box === undefined ? undefined : arrowDirs(g, g.sel).find((o) => nb(g.L, box, o) === k);
    if (d) return pushVia(g, g.sel, d, now) ?? g;
  }
  const path = findPath(g.L, boxSet(g), g.p, k);
  return path ? act(g, path, now) : clear();
}
