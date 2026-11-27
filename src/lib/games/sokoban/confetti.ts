// Konfetti beim Sieg, rein: Teilchen werfen und bewegen. Eigene Datei, weil nur der nachgeladene Teil `ks-menu` sie
// braucht (der Kern zeichnet die Teilchen nur). Zeit und Zufall kommen als Parameter, die Farben vom Aufrufer.
import type { Level } from './level';
import type { Particle } from './scene';

export const CONFETTI_PER_BOX = 18;
export const CONFETTI_LIFE = 1400;
export const GRAVITY = 6;

const xy = (L: Pick<Level, 'W'>, k: number): [c: number, r: number] => [k % L.W, Math.floor(k / L.W)];

/**
 * Konfetti beim Sieg: je Kiste 18 Teilchen ab der Kistenmitte in Höhe 0,9, Richtung und Tempo zufällig, Farben
 * reihum. Der Aufrufer lässt es bei weniger Bewegung und nach vorgespielter Lösung weg.
 */
export function confetti(
  L: Pick<Level, 'W'>,
  boxes: readonly number[],
  now: number,
  random: () => number,
  colours: readonly string[],
): Particle[] {
  const out: Particle[] = [];
  for (const b of boxes) {
    const [c, r] = xy(L, b);
    for (let k = 0; k < CONFETTI_PER_BOX; k++) {
      const ang = random() * Math.PI * 2;
      const sp = 0.6 + random() * 0.8;
      const vz = 2.2 + random() * 1.4;
      const col = colours[k % colours.length] ?? '#ffffff';
      out.push({ x: c + 0.5, y: r + 0.5, z: 0.9, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vz, col, t0: now });
    }
  }
  return out;
}

/** Ein Takt (dt in s, fest 1/60 wie im Entwurf): fliegen, fallen; weg nach 1400 ms oder unter z −0,1 */
export function stepParticles(ps: readonly Particle[], now: number, dt = 1 / 60): Particle[] {
  return ps
    .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, z: p.z + p.vz * dt, vz: p.vz - GRAVITY * dt }))
    .filter((p) => now - p.t0 < CONFETTI_LIFE && p.z > -0.1);
}
