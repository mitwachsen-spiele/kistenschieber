// Feine Texturen „An der Kaje“, gezeichnet statt gepixelt, wörtlich aus dem Entwurf. Jeder Zeichner malt eine Fläche
// von 64 × 64 Einheiten gegen einen Pen: im Browser eine Canvas (128 px, scale 2), beim Build svgPen. Der Zufall
// kommt aus einem festen Seed, die Texturen sehen also immer gleich aus.
import type { Pen } from './pen';
import { type Rand, mulberry32 } from './rng';

/** Kantenlänge einer Textur in Zeicheneinheiten */
export const TEX = 64;

export interface Texture {
  readonly name: string;
  readonly seed: number;
  draw(pen: Pen, R: Rand): void;
}

/** Deckel und Seiten eines Blocks */
export interface BlockFaces {
  readonly top: Texture;
  readonly side: Texture;
}

/** Textur mit frischem Zufall aus ihrem Seed zeichnen */
export function paint(pen: Pen, t: Texture): void {
  t.draw(pen, mulberry32(t.seed));
}

function rr(x: Pen, X: number, Y: number, W: number, H: number, r: number): void {
  x.beginPath();
  if (x.roundRect) x.roundRect(X, Y, W, H, r);
  else x.rect(X, Y, W, H);
}

const pickR = <T>(R: Rand, arr: readonly T[]): T => arr[Math.floor(R() * arr.length)]!;

function speckle(x: Pen, R: Rand, n: number, cols: readonly string[]): void {
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[i % cols.length]!;
    x.fillRect(R() * TEX, R() * TEX, 0.7, 0.7);
  }
}

/** Maserung: n Linien aus je 4 Quadratkurven */
function grain(x: Pen, R: Rand, X: number, Y: number, W: number, H: number, n: number, col: string): void {
  x.strokeStyle = col;
  x.lineWidth = 0.5;
  for (let i = 0; i < n; i++) {
    const y = Y + 1 + R() * (H - 2);
    x.beginPath();
    x.moveTo(X, y);
    for (let s = 1; s <= 4; s++)
      x.quadraticCurveTo(X + ((s - 0.5) * W) / 4, y + (R() - 0.5) * 1.6, X + (s * W) / 4, y + (R() - 0.5) * 0.6);
    x.stroke();
  }
}

/** Klinker im Läuferverband: kleine Steine, jede Reihe versetzt (Boden oben) */
export const klinker: Texture = {
  name: 'klinker',
  seed: 11,
  draw(x, R) {
    x.fillStyle = '#6a3a28';
    x.fillRect(0, 0, TEX, TEX);
    for (let row = 0; row < 8; row++)
      for (let bx = row % 2 ? -8 : 0; bx < TEX; bx += 16) {
        const y = row * 8;
        x.fillStyle = pickR(R, ['#a9583c', '#9e5035', '#b4633f', '#94492f', '#a45a40', '#ae5e43']);
        rr(x, bx + 0.7, y + 0.7, 14.6, 6.6, 1.4);
        x.fill();
        x.fillStyle = 'rgba(255,240,220,.13)';
        x.fillRect(bx + 1.2, y + 1, 13.6, 1.1);
        x.fillStyle = 'rgba(0,0,0,.13)';
        x.fillRect(bx + 1.2, y + 5.9, 13.6, 0.9);
      }
    speckle(x, R, 140, ['rgba(60,25,15,.35)', 'rgba(255,220,200,.25)']);
  },
};

/** Granitquader mit Sprenkeln (Seiten von Boden und Mauer) */
export const granit: Texture = {
  name: 'granit',
  seed: 23,
  draw(x, R) {
    x.fillStyle = '#59606a';
    x.fillRect(0, 0, TEX, TEX);
    const h = TEX / 3;
    for (let row = 0; row < 3; row++)
      for (let bx = row % 2 ? -16 : 0; bx < TEX; bx += 32) {
        x.fillStyle = pickR(R, ['#a1a9b2', '#959da7', '#a7aeb6', '#9aa2ac']);
        rr(x, bx + 0.9, row * h + 0.9, 30.2, h - 1.8, 1.2);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,.2)';
        x.fillRect(bx + 1.5, row * h + 1.2, 29, 1);
      }
    speckle(x, R, 420, ['rgba(70,76,86,.55)', 'rgba(230,235,240,.6)', 'rgba(110,116,126,.5)']);
  },
};

/** Kaimauer oben: eine Granitplatte mit Fase */
export const kai: Texture = {
  name: 'kai',
  seed: 37,
  draw(x, R) {
    x.fillStyle = '#b2b9c1';
    x.fillRect(0, 0, TEX, TEX);
    speckle(x, R, 380, ['rgba(80,88,98,.45)', 'rgba(240,244,248,.7)', 'rgba(120,128,138,.45)']);
    x.strokeStyle = 'rgba(255,255,255,.5)';
    x.lineWidth = 2.2;
    x.strokeRect(1.6, 1.6, 60.8, 60.8);
    x.strokeStyle = 'rgba(40,48,58,.22)';
    x.lineWidth = 1;
    x.strokeRect(4.2, 4.2, 55.6, 55.6);
  },
};

/** Wasser von oben: Verlauf mit hellen Wellen, über den Rand gekachelt */
export const wasser: Texture = {
  name: 'wasser',
  seed: 41,
  draw(x, R) {
    const g = x.createLinearGradient(0, 0, 0, TEX);
    g.addColorStop(0, '#53a3d6');
    g.addColorStop(1, '#3a86bb');
    x.fillStyle = g;
    x.fillRect(0, 0, TEX, TEX);
    x.strokeStyle = 'rgba(255,255,255,0.42)';
    x.lineWidth = 1.1;
    x.lineCap = 'round';
    for (let i = 0; i < 11; i++) {
      const y = R() * TEX;
      const x0 = R() * TEX;
      const l = 6 + R() * 8;
      for (const dx of [0, -TEX, TEX]) {
        x.beginPath();
        x.moveTo(x0 + dx, y);
        x.quadraticCurveTo(x0 + dx + l / 2, y - 2.2, x0 + dx + l, y);
        x.stroke();
      }
    }
  },
};

/** Wasser von der Seite: dunkler Verlauf mit Glanzstrichen */
export const wasserSeite: Texture = {
  name: 'wasserSeite',
  seed: 43,
  draw(x, R) {
    const g = x.createLinearGradient(0, 0, 0, TEX);
    g.addColorStop(0, '#2f74a3');
    g.addColorStop(1, '#1f5378');
    x.fillStyle = g;
    x.fillRect(0, 0, TEX, TEX);
    x.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 6; i++) x.fillRect(R() * TEX, 4 + R() * 56, 6 + R() * 10, 0.8);
  },
};

export interface CrateOptions {
  /** auf dem Ziel: grüner Rahmen */
  readonly ok?: boolean;
  /** Querstrebe (Seiten) */
  readonly brace?: boolean;
  /** Haken (Deckel auf dem Ziel) */
  readonly check?: boolean;
}

const CRATE_FRAME = { blue: ['#24527f', '#4580b8', '#183b5c'], green: ['#2b7a42', '#4ea267', '#1e5a30'] } as const;

function crateFrame(x: Pen, ok: boolean): void {
  const [F, FL, FD] = CRATE_FRAME[ok ? 'green' : 'blue'];
  x.fillStyle = F;
  x.fillRect(0, 0, TEX, TEX);
  x.fillStyle = FL;
  x.fillRect(0, 0, TEX, 1.6);
  x.fillRect(0, 0, 1.6, TEX);
  x.fillStyle = FD;
  x.fillRect(0, 62.4, TEX, 1.6);
  x.fillRect(62.4, 0, 1.6, TEX);
}

const I = 7;
const IW = TEX - 2 * I;

function crateBoards(x: Pen, R: Rand): void {
  const ph = IW / 4;
  for (let p = 0; p < 4; p++) {
    x.fillStyle = p % 2 ? '#d7ae74' : '#e4bf88';
    x.fillRect(I, I + p * ph, IW, ph);
    grain(x, R, I, I + p * ph, IW, ph, 3, 'rgba(140,95,50,.32)');
    x.fillStyle = '#9c7243';
    x.fillRect(I, I + p * ph - 0.4, IW, 0.8);
  }
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.fillRect(I, I, IW, 1);
  x.fillRect(I, I, 1, IW);
}

function crateBrace(x: Pen): void {
  x.save();
  x.beginPath();
  x.rect(I, I, IW, IW);
  x.clip();
  x.lineCap = 'butt';
  x.strokeStyle = 'rgba(0,0,0,.22)';
  x.lineWidth = 9;
  x.beginPath();
  x.moveTo(I - 2, 66 - I);
  x.lineTo(66 - I, I - 2);
  x.stroke();
  x.strokeStyle = '#cfa266';
  x.lineWidth = 7;
  x.stroke();
  x.restore();
}

function crateRivets(x: Pen): void {
  for (const [bx, by] of [
    [3.5, 3.5],
    [60.5, 3.5],
    [3.5, 60.5],
    [60.5, 60.5],
  ] as const) {
    x.fillStyle = '#d5dde4';
    x.beginPath();
    x.arc(bx, by, 1.7, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(0,0,0,.35)';
    x.beginPath();
    x.arc(bx + 0.4, by + 0.4, 0.6, 0, Math.PI * 2);
    x.fill();
  }
}

function crateCheck(x: Pen): void {
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.strokeStyle = 'rgba(20,50,30,.55)';
  x.lineWidth = 9.5;
  x.beginPath();
  x.moveTo(18, 33);
  x.lineTo(28, 43);
  x.lineTo(47, 21);
  x.stroke();
  x.strokeStyle = '#fff6d2';
  x.lineWidth = 6.5;
  x.stroke();
}

/** Kiste: blauer (auf dem Ziel grüner) Rahmen, Bretter mit Maserung, auf den Seiten eine Querstrebe */
export function kiste({ ok = false, brace = false, check = false }: CrateOptions = {}): Texture {
  return {
    name: `kiste${ok ? '-ok' : ''}${brace ? '-strebe' : ''}${check ? '-haken' : ''}`,
    seed: ok ? 59 : 53,
    draw(x, R) {
      crateFrame(x, ok);
      crateBoards(x, R);
      if (brace) crateBrace(x);
      crateRivets(x);
      if (check) crateCheck(x);
    },
  };
}
