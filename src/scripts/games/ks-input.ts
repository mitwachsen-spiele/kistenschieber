// Eingabe im Spiel, rein und getestet: welche Taste was bedeutet (wie im Entwurf). Pfeile und WASD laufen, Z und
// Backspace nehmen einen Zug zurück, R startet neu, H gibt einen Tipp, M öffnet das Menü, Esc hebt die Auswahl auf
// (sonst Menü), Enter geht nach dem Sieg weiter. Ignoriert werden Tasten bei offenem Dialog, in Formularfeldern und mit
// Alt, Strg oder Meta (Tastenkürzel des Browsers).
import type { DirKey } from '../../lib/games/sokoban/level';

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
