import { describe, expect, it } from 'vitest';
import type { Pen, PenGradient, PenStyle } from './pen';
import { mulberry32 } from './rng';
import { TEX, type Texture, granit, kai, kiste, klinker, paint, wasser, wasserSeite } from './textures';

type Cmd = readonly [string, ...unknown[]];

/** Pen, der jeden Befehl und jede Zuweisung mitschreibt */
class RecordingPen implements Pen {
  readonly log: Cmd[] = [];
  private fill_: PenStyle = '#000';
  private stroke_: PenStyle = '#000';
  private lw = 1;
  private cap: Pen['lineCap'] = 'butt';
  private join: Pen['lineJoin'] = 'miter';
  roundRect?: Pen['roundRect'];
  constructor(round = true) {
    if (round) this.roundRect = this.rec('roundRect');
  }
  get fillStyle() {
    return this.fill_;
  }
  set fillStyle(v) {
    this.fill_ = v;
    this.log.push(['fillStyle', typeof v === 'string' ? v : 'Verlauf']);
  }
  get strokeStyle() {
    return this.stroke_;
  }
  set strokeStyle(v) {
    this.stroke_ = v;
    this.log.push(['strokeStyle', typeof v === 'string' ? v : 'Verlauf']);
  }
  get lineWidth() {
    return this.lw;
  }
  set lineWidth(v) {
    this.lw = v;
    this.log.push(['lineWidth', v]);
  }
  get lineCap() {
    return this.cap;
  }
  set lineCap(v) {
    this.cap = v;
    this.log.push(['lineCap', v]);
  }
  get lineJoin() {
    return this.join;
  }
  set lineJoin(v) {
    this.join = v;
    this.log.push(['lineJoin', v]);
  }
  private rec(name: string) {
    return (...a: unknown[]) => void this.log.push([name, ...a]);
  }
  save = this.rec('save');
  restore = this.rec('restore');
  beginPath = this.rec('beginPath');
  closePath = this.rec('closePath');
  moveTo = this.rec('moveTo');
  lineTo = this.rec('lineTo');
  quadraticCurveTo = this.rec('quadraticCurveTo');
  rect = this.rec('rect');
  arc = this.rec('arc');
  fill = this.rec('fill');
  stroke = this.rec('stroke');
  clip = this.rec('clip');
  fillRect = this.rec('fillRect');
  strokeRect = this.rec('strokeRect');
  createLinearGradient(...a: number[]): PenGradient {
    this.log.push(['createLinearGradient', ...a]);
    return { addColorStop: (o, c) => void this.log.push(['addColorStop', o, c]) };
  }
}

function record(t: Texture, round = true): Cmd[] {
  const pen = new RecordingPen(round);
  paint(pen, t);
  return pen.log;
}

const ALL: Texture[] = [
  klinker,
  granit,
  kai,
  wasser,
  wasserSeite,
  kiste(),
  kiste({ brace: true }),
  kiste({ ok: true, check: true }),
  kiste({ ok: true, brace: true }),
];

/** Die Canvas ist ein Pen (nur Typprüfung, läuft nicht) */
export const canvasIsPen = (ctx: CanvasRenderingContext2D): Pen => ctx;

describe('mulberry32', () => {
  it('liefert aus demselben Seed dieselbe Folge in [0, 1) wie rng() im Entwurf', () => {
    const a = mulberry32(11);
    const b = mulberry32(11);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(12)()).not.toBe(xs[0]);
    // erster Wert für Seed 1, nachgerechnet mit der Formel des Entwurfs
    let seed = 1;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    expect(mulberry32(1)()).toBe(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  });
});

describe('Textur-Zeichner', () => {
  it('sind deterministisch: zwei Läufe geben dieselbe Befehlsliste', () => {
    for (const t of ALL) {
      const a = record(t);
      expect(a.length).toBeGreaterThan(5);
      expect(record(t)).toEqual(a);
    }
  });

  it('füllen zuerst die ganze Fläche von 64 × 64', () => {
    expect(TEX).toBe(64);
    for (const t of ALL) expect(record(t)).toContainEqual(['fillRect', 0, 0, 64, 64]);
  });

  it('tragen die Seeds des Entwurfs', () => {
    expect([klinker, granit, kai, wasser, wasserSeite].map((t) => t.seed)).toEqual([11, 23, 37, 41, 43]);
    expect(kiste().seed).toBe(53);
    expect(kiste({ ok: true }).seed).toBe(59);
  });

  it('Klinker: Grund #6a3a28, 8 Reihen Steine aus der Palette, 140 Sprenkel', () => {
    const log = record(klinker);
    expect(log[0]).toEqual(['fillStyle', '#6a3a28']);
    const stones = log.filter((c) => c[0] === 'roundRect');
    // gerade Reihen 4 Steine, ungerade 5 (versetzt um −8)
    expect(stones).toHaveLength(4 * 4 + 4 * 5);
    expect(stones[0]).toEqual(['roundRect', 0.7, 0.7, 14.6, 6.6, 1.4]);
    expect(stones[4]![1]).toBeCloseTo(-7.3, 12);
    const palette = ['#a9583c', '#9e5035', '#b4633f', '#94492f', '#a45a40', '#ae5e43'];
    const fills = log.filter((c) => c[0] === 'fillStyle').map((c) => c[1]);
    expect(fills.filter((f) => palette.includes(f as string))).toHaveLength(36);
    expect(log.filter((c) => c[0] === 'fillRect' && c[3] === 0.7)).toHaveLength(140);
  });

  it('fällt ohne roundRect auf rect zurück', () => {
    const log = record(klinker, false);
    expect(log.some((c) => c[0] === 'roundRect')).toBe(false);
    expect(log.filter((c) => c[0] === 'rect')).toHaveLength(36);
  });

  it('Granit: 3 Reihen Quader, 420 Sprenkel', () => {
    const log = record(granit);
    expect(log[0]).toEqual(['fillStyle', '#59606a']);
    expect(log.filter((c) => c[0] === 'roundRect')).toHaveLength(2 + 3 + 2);
    expect(log.filter((c) => c[0] === 'fillRect' && c[3] === 0.7)).toHaveLength(420);
  });

  it('Kaimauer: Platte #b2b9c1 mit Fase', () => {
    const log = record(kai);
    expect(log[0]).toEqual(['fillStyle', '#b2b9c1']);
    expect(log).toContainEqual(['strokeRect', 1.6, 1.6, 60.8, 60.8]);
    expect(log).toContainEqual(['strokeRect', 4.2, 4.2, 55.6, 55.6]);
  });

  it('Wasser: Verlauf #53a3d6 → #3a86bb, 11 Wellen je dreimal gekachelt', () => {
    const log = record(wasser);
    expect(log).toContainEqual(['addColorStop', 0, '#53a3d6']);
    expect(log).toContainEqual(['addColorStop', 1, '#3a86bb']);
    expect(log.filter((c) => c[0] === 'quadraticCurveTo')).toHaveLength(33);
    expect(log).toContainEqual(['strokeStyle', 'rgba(255,255,255,0.42)']);
  });

  it('Wasser-Seite: Verlauf #2f74a3 → #1f5378 und 6 Glanzstriche', () => {
    const log = record(wasserSeite);
    expect(log).toContainEqual(['addColorStop', 0, '#2f74a3']);
    expect(log).toContainEqual(['addColorStop', 1, '#1f5378']);
    expect(log.filter((c) => c[0] === 'fillRect' && c[4] === 0.8)).toHaveLength(6);
  });
});

describe('Kiste', () => {
  const strokes = (log: Cmd[]) => log.filter((c) => c[0] === 'strokeStyle').map((c) => c[1]);

  it('blau: Rahmen #24527f, Licht #4580b8, Schatten #183b5c, vier Bretter, Nieten', () => {
    const log = record(kiste());
    expect(log[0]).toEqual(['fillStyle', '#24527f']);
    expect(log).toContainEqual(['fillStyle', '#4580b8']);
    expect(log).toContainEqual(['fillStyle', '#183b5c']);
    expect(log.filter((c) => c[0] === 'fillStyle' && (c[1] === '#e4bf88' || c[1] === '#d7ae74'))).toHaveLength(4);
    expect(log.filter((c) => c[0] === 'arc')).toHaveLength(8);
    expect(log).toContainEqual(['arc', 3.5, 3.5, 1.7, 0, Math.PI * 2]);
    expect(log.some((c) => c[0] === 'clip')).toBe(false);
  });

  it('auf dem Ziel grün: Rahmen #2b7a42, Licht #4ea267, Schatten #1e5a30', () => {
    const log = record(kiste({ ok: true }));
    expect(log[0]).toEqual(['fillStyle', '#2b7a42']);
    expect(log).toContainEqual(['fillStyle', '#4ea267']);
    expect(log).toContainEqual(['fillStyle', '#1e5a30']);
    expect(log.some((c) => c[1] === '#24527f')).toBe(false);
  });

  it('Strebe nur auf den Seiten: geclippte Diagonale, Schatten 9, Holz #cfa266 7', () => {
    const log = record(kiste({ brace: true }));
    const at = log.findIndex((c) => c[0] === 'clip');
    expect(at).toBeGreaterThan(0);
    expect(log).toContainEqual(['moveTo', 5, 59]);
    expect(log).toContainEqual(['lineTo', 59, 5]);
    expect(strokes(log)).toContain('#cfa266');
    expect(log.filter((c) => c[0] === 'save')).toHaveLength(1);
    expect(log.filter((c) => c[0] === 'restore')).toHaveLength(1);
  });

  it('der ok-Deckel zeichnet den Haken (18,33) → (28,43) → (47,21), Schatten und #fff6d2', () => {
    const log = record(kiste({ ok: true, check: true }));
    const from = log.findIndex((c) => c[0] === 'moveTo' && c[1] === 18 && c[2] === 33);
    expect(from).toBeGreaterThan(0);
    expect(log[from + 1]).toEqual(['lineTo', 28, 43]);
    expect(log[from + 2]).toEqual(['lineTo', 47, 21]);
    expect(strokes(log).slice(-2)).toEqual(['rgba(20,50,30,.55)', '#fff6d2']);
    expect(log).toContainEqual(['lineWidth', 9.5]);
    expect(log).toContainEqual(['lineWidth', 6.5]);
    expect(record(kiste({ ok: true })).some((c) => c[0] === 'moveTo' && c[1] === 18 && c[2] === 33)).toBe(false);
  });

  it('heißt je Variante anders (Cache-Schlüssel)', () => {
    const names = ALL.slice(5).map((t) => t.name);
    expect(new Set(names).size).toBe(4);
  });
});
