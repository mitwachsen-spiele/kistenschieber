// Nachgeladener Teil des Spiels (per import() über later(), ks-game.ts): das Konfetti beim Sieg. Was man nicht ständig
// braucht, hält den Kern klein; der Spielbildschirm holt diesen Teil, sobald eine Lektion offen ist. Das Menü selbst
// und „Lösung zeigen“ bleiben im Kern: Das Menü ist während einer Lektion der einzige Weg hinaus und darf nicht am
// Nachladen hängen, die Lösung braucht der Takt (autoStep). Der Name bleibt ks-menu (Plan, PWA-Test in Schritt 8).
import type { Level } from '../../lib/games/sokoban/level';
import { confetti, stepParticles } from '../../lib/games/sokoban/confetti';
import type { Particle } from '../../lib/games/sokoban/scene';
import { CONFETTI } from '../../data/games/kaje';

/** Konfetti beim eigenen Sieg: Teilchen über allen Kisten in den Farben des Kais */
export const burst = (L: Level, boxes: readonly number[], now: number): Particle[] =>
  confetti(L, boxes, now, Math.random, CONFETTI);

export { stepParticles };
