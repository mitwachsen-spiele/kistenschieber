// Zufall aus einem Seed (mulberry32, wie im Entwurf): Dieselbe Zahl ergibt immer dieselbe Folge. Damit sehen die
// gezeichneten Texturen bei jedem Aufruf gleich aus, im Browser wie beim Build.

/** Liefert Zahlen in [0, 1) */
export type Rand = () => number;

export function mulberry32(seed: number): Rand {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
