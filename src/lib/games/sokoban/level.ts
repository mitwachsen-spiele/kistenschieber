// Sokoban-Level: XSB lesen, Nachbarn, begehbare Felder und Felder, auf denen eine Kiste noch ein Ziel erreicht.
// Rein und browser-sicher. Gitter-Index k = r * W + c; Richtungen als [dr, dc].

/** Eine Richtung als [Zeilenschritt, Spaltenschritt] */
export type Dir = readonly [dr: -1 | 0 | 1, dc: -1 | 0 | 1];

export const DIRS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
} as const satisfies Record<string, Dir>;

export type DirKey = keyof typeof DIRS;

/** Reihenfolge oben, unten, links, rechts: Sie entscheidet Gleichstände in Löser, Tipp und Laufweg */
export const D4: readonly Dir[] = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];

/** Gegenrichtung (ohne -0) */
export function opposite([dr, dc]: Dir): Dir {
  return [(0 - dr) as Dir[0], (0 - dc) as Dir[1]];
}

/** Blickrichtung der Figur in Weltachsen (i = Spalte, j = Zeile) */
export type Facing = 'i' | '-i' | 'j' | '-j';

export function dirName(dr: number, dc: number): Facing {
  if (dr < 0) return '-j';
  if (dr > 0) return 'j';
  return dc > 0 ? 'i' : '-i';
}

export interface Level {
  readonly W: number;
  readonly H: number;
  readonly walls: ReadonlySet<number>;
  readonly goals: ReadonlySet<number>;
  /** Kistenfelder in Lesereihenfolge; der Index ist die Kisten-ID */
  readonly boxes: readonly number[];
  readonly player: number;
  /** begehbare Felder: Flutfüllung von der Figur durch alles außer Wänden */
  readonly inside: ReadonlySet<number>;
  /** Felder, von denen eine Kiste noch ein Ziel erreicht (rückwärts von den Zielen gezogen) */
  readonly live: ReadonlySet<number>;
}

/** Nachbar von k, n Schritte in Richtung d; -1 außerhalb des Rechtecks */
export function nb(L: Pick<Level, 'W' | 'H'>, k: number, [dr, dc]: Dir, n = 1): number {
  const r = Math.floor(k / L.W) + dr * n;
  const c = (k % L.W) + dc * n;
  return r < 0 || c < 0 || r >= L.H || c >= L.W ? -1 : r * L.W + c;
}

/** XSB: # Wand, . Ziel, $ Kiste, * Kiste auf Ziel, @ Figur, + Figur auf Ziel, Leerzeichen. Breite = längste Zeile */
export function parseLevel(xsb: string): Level {
  const rows = xsb.split('\n');
  const H = rows.length;
  const W = Math.max(...rows.map((r) => r.length));
  const walls = new Set<number>();
  const goals = new Set<number>();
  const boxes: number[] = [];
  let player = -1;
  rows.forEach((row, r) => {
    for (let c = 0; c < W; c++) {
      const ch = row[c] ?? ' ';
      const k = r * W + c;
      if (ch === '#') walls.add(k);
      if ('.*+'.includes(ch)) goals.add(k);
      if ('$*'.includes(ch)) boxes.push(k);
      if ('@+'.includes(ch)) player = k;
    }
  });
  if (player < 0) throw new Error('Level ohne Figur (@ oder +)');
  const size = { W, H };
  const inside = new Set([player]);
  const q = [player];
  for (let k = q.pop(); k !== undefined; k = q.pop()) {
    for (const d of D4) {
      const n = nb(size, k, d);
      if (n >= 0 && !walls.has(n) && !inside.has(n)) {
        inside.add(n);
        q.push(n);
      }
    }
  }
  const live = pullFrom(size, inside, goals);
  return { W, H, walls, goals, boxes, player, inside, live };
}

/**
 * Rückwärts ziehen: Von k aus kann eine Kiste auf b = nb(k, d) nach k geschoben werden, wenn die Figur auf
 * p = nb(k, d, 2) steht und b und p begehbar sind. Liefert die Felder, die so ein Ziel erreichen.
 */
function pullFrom(size: Pick<Level, 'W' | 'H'>, inside: ReadonlySet<number>, goals: ReadonlySet<number>): Set<number> {
  const live = new Set(goals);
  const q = [...goals];
  for (let k = q.pop(); k !== undefined; k = q.pop()) {
    for (const d of D4) {
      const b = nb(size, k, d);
      const p = nb(size, k, d, 2);
      if (b >= 0 && p >= 0 && inside.has(b) && inside.has(p) && !live.has(b)) {
        live.add(b);
        q.push(b);
      }
    }
  }
  return live;
}

export type CellType = 'out' | 'wall' | 'floor';

/** Art eines Feldes: außerhalb des Rechtecks oder der Mauern 'out', sonst Wand oder Boden */
export function cellType(L: Level): (r: number, c: number) => CellType {
  return (r, c) => {
    if (r < 0 || c < 0 || r >= L.H || c >= L.W) return 'out';
    const k = r * L.W + c;
    if (L.walls.has(k)) return 'wall';
    return L.inside.has(k) ? 'floor' : 'out';
  };
}

/** Ein Schritt einer LURD-Lösung: Großbuchstabe = Schub, Kleinbuchstabe = Laufschritt */
export interface LurdStep {
  readonly dir: Dir;
  readonly push: boolean;
}

const LURD: Readonly<Record<string, Dir>> = { u: DIRS.up, d: DIRS.down, l: DIRS.left, r: DIRS.right };

export function parseLurd(sol: string): LurdStep[] {
  return [...sol].map((ch) => {
    const dir = LURD[ch.toLowerCase()];
    if (!dir) throw new Error(`Unbekannter Zug „${ch}“ in der Lösung`);
    return { dir, push: ch !== ch.toLowerCase() };
  });
}
