// Eine Szene auf eine Canvas zeichnen (renderWorld im Entwurf, nur „fein“ und schräg): Boden und Wasserrand, weiche
// Schatten, Ziele, dann alles Aufrechte nach Tiefe (Mauern, Kisten, Figur, Schmuck, Konfetti), obenauf die Pfeile.
// Liefert die Ansicht und die Trefferflächen (für pick in lib/games/oblique/geometry.ts) als Wert.
import { IS, type Camera, type Point, type View, fitScene, makeView } from '../../../lib/games/oblique/camera';
import {
  type Hits,
  type HitObj,
  type FloorHit,
  arrowPoly,
  ellipse,
  flatPts,
  hull,
  square,
} from '../../../lib/games/oblique/geometry';
import { type Cuboid, cuboidFaces, humanoid, modelCuboids } from '../../../lib/games/oblique/models';
import { D4, type CellType } from '../../../lib/games/sokoban/level';
import type { World } from '../../../lib/games/sokoban/scene';
import { ARROW_FILL, EDGE, FRAUKE, GOAL, INK, K, LINE, MARK, RING_Z, SHADOW, WH } from '../../../data/games/kaje';
import { type Blocks, blocksFor, drawBlock } from './blocks';

export interface RenderOptions {
  /** größter Maßstab */
  readonly maxS?: number;
  /** höchstens so hoch (CSS-px) */
  readonly maxH?: number;
  readonly pad?: number;
  /** ohne Wasserrand (schmale Szenen) */
  readonly noRing?: boolean;
}

export interface Rendered {
  readonly view: View;
  readonly hits: Hits;
}

type Ctx = CanvasRenderingContext2D;
type Cell = readonly [r: number, c: number, t: CellType];
interface Item {
  readonly k: number;
  draw(x: Ctx): void;
}

/** Vieleck füllen und umranden (Kontur ohne eigene Farbe = Füllung) */
function poly(x: Ctx, pts: readonly Point[], fill: string | CanvasGradient | null, stroke?: string, lw?: number) {
  const [first, ...rest] = pts;
  if (!first) return;
  x.beginPath();
  x.moveTo(first[0], first[1]);
  for (const [px, py] of rest) x.lineTo(px, py);
  x.closePath();
  if (fill) {
    x.fillStyle = fill;
    x.fill();
  }
  x.lineJoin = 'round';
  x.strokeStyle = stroke ?? (typeof fill === 'string' ? fill : 'rgba(0,0,0,0)');
  x.lineWidth = lw || 0.6;
  x.stroke();
}

/** Nur füllen, ohne Kontur (weiche Verläufe) */
function fillPath(x: Ctx, pts: readonly Point[], fill: CanvasGradient) {
  x.beginPath();
  pts.forEach(([px, py], n) => (n ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.closePath();
  x.fillStyle = fill;
  x.fill();
}

const cuboidItem = (V: View, c: Cuboid): Item => ({
  k: c.k,
  draw: (x) => {
    for (const f of cuboidFaces(V, c)) poly(x, f.pts, f.fill);
  },
});

/** Canvas auf die Größe der Szene bringen (Backing-Store × dpr ≤ 2), Kontext vorbereitet */
function prepare(cv: HTMLCanvasElement, w: number, h: number): Ctx | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (cv.width !== bw || cv.height !== bh) {
    cv.width = bw;
    cv.height = bh;
  }
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const x = cv.getContext('2d');
  if (!x) return null;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  return x;
}

/** 1. Boden unter Boden und Mauern, Wasser ringsum; hinten zuerst */
function drawGround(x: Ctx, V: View, im: Blocks, cells: readonly Cell[], ring: boolean, floors: FloorHit[]) {
  for (const [r, c, t] of cells) {
    if (t === 'floor' || t === 'wall') {
      drawBlock(x, V, im.floor, c, r, -1);
      if (t === 'floor') floors.push({ r, c, poly: flatPts(V, square(c + 0.5, r + 0.5, 0.5), 0) });
    } else if (ring) drawBlock(x, V, im.ring, c, r, RING_Z - 1);
  }
}

/** Weiche Schatten dort, wo der Boden an eine Mauer stößt */
function drawContact(x: Ctx, V: View, W: World, cells: readonly Cell[]) {
  const S = SHADOW.contact;
  for (const [r, c, t] of cells) {
    if (t !== 'floor') continue;
    for (const [dr, dc] of D4) {
      if (W.type(r + dr, c + dc) !== 'wall') continue;
      const cx = c + 0.5;
      const cy = r + 0.5;
      const e = [cx + S.edge * dc, cy + S.edge * dr] as const;
      const n = [cx + S.inner * dc, cy + S.inner * dr] as const;
      const px = -dr * 0.5;
      const py = dc * 0.5;
      const P = flatPts(
        V,
        [
          [e[0] + px, e[1] + py],
          [e[0] - px, e[1] - py],
          [n[0] - px, n[1] - py],
          [n[0] + px, n[1] + py],
        ],
        S.z,
      );
      const [ex, ey] = V.Q(e[0], e[1], S.z);
      const [nx, ny] = V.Q(n[0], n[1], S.z);
      const gr = x.createLinearGradient(ex, ey, nx, ny);
      gr.addColorStop(0, S.from);
      gr.addColorStop(1, S.to);
      fillPath(x, P, gr);
    }
  }
}

/** 2. Flaches: Ziele (ohne Schatten), Schatten der Kisten und der Figuren */
function drawFlat(x: Ctx, V: View, W: World) {
  for (const g of W.goals) for (const q of GOAL) poly(x, flatPts(V, square(g.c + 0.5, g.r + 0.5, q.half), q.z), q.col);
  for (const b of W.crates)
    for (const q of SHADOW.crate)
      poly(
        x,
        flatPts(V, square(b.x + 0.5, b.y + 0.5, q.half), 0.01),
        `rgba(${SHADOW.crateRgb},${q.alpha})`,
        'rgba(0,0,0,0)',
      );
  const F = SHADOW.figure;
  for (const f of W.figs) {
    const [fx, fy] = V.Q(f.x, f.y, F.z);
    const gr = x.createRadialGradient(fx, fy, 0, fx, fy, F.rx * IS * V.s);
    gr.addColorStop(0, F.from);
    gr.addColorStop(1, F.to);
    fillPath(x, flatPts(V, ellipse(f.x, f.y, F.rx, F.ry), F.z), gr);
  }
}

/** 3. Aufrechtes als Liste mit Tiefe; Treffer für Mauern, Kisten und Figuren */
function upright(V: View, W: World, im: Blocks, cells: readonly Cell[], objs: HitObj[]): Item[] {
  const items: Item[] = [];
  for (const [r, c, t] of cells) {
    if (t !== 'wall') continue;
    const k = V.key(c + 0.5, r + 0.5, WH / 2);
    items.push({
      k,
      draw: (x) => {
        drawBlock(x, V, im.wall, c, r, 0);
        poly(x, flatPts(V, square(c + 0.5, r + 0.5, 0.49), WH), null, EDGE.wall, LINE.edge * V.s);
      },
    });
    objs.push({ type: 'wall', r, c, k, poly: hull(V, c, r, 0, 1, 1, WH) });
  }
  const off = (1 - K) / 2;
  for (const b of W.crates) {
    const P = hull(V, b.x + off, b.y + off, 0, K, K, K);
    const k = V.key(b.x + 0.5, b.y + 0.5, K / 2);
    items.push({
      k,
      draw: (x) => {
        drawBlock(x, V, b.ok ? im.crateOk : im.crate, b.x, b.y, 0, K);
        poly(x, flatPts(V, square(b.x + 0.5, b.y + 0.5, K / 2 - 0.01), K), null, EDGE.crate, LINE.edge * V.s);
        if (b.mark) poly(x, P, null, MARK[b.mark], LINE.mark * V.s);
      },
    });
    objs.push({ type: 'crate', id: b.id, k, poly: P });
  }
  for (const f of W.figs) {
    for (const c of modelCuboids(V.cam, humanoid(FRAUKE, f.pose, f.a), f.x, f.y, f.z, f.dir))
      items.push(cuboidItem(V, c));
    objs.push({ type: 'fig', k: V.key(f.x, f.y, 0.5), poly: hull(V, f.x - 0.2, f.y - 0.2, 0, 0.4, 0.4, 1.05) });
  }
  for (const d of W.deco)
    for (const c of modelCuboids(V.cam, d.parts, d.x, d.y, d.z, d.dir, d.sc)) items.push(cuboidItem(V, c));
  for (const p of W.fx) {
    const c = { i0: p.x - 0.04, j0: p.y - 0.04, z0: p.z, w: 0.08, d: 0.08, h: 0.08, col: p.col, top: null };
    items.push(cuboidItem(V, { ...c, k: V.key(p.x, p.y, p.z) }));
  }
  return items;
}

/** Szene W mit Kamera cam auf die Canvas cv; Breite aus dem Elternelement */
export function renderWorld(cv: HTMLCanvasElement, W: World, cam: Camera, opt: RenderOptions = {}): Rendered {
  const fit = fitScene(cam, W, {
    width: cv.parentElement?.clientWidth ?? 0,
    maxS: opt.maxS,
    maxH: opt.maxH,
    pad: opt.pad,
    noRing: opt.noRing,
    ringZ: RING_Z,
  });
  const V = makeView(cam, fit.ox, fit.oy, fit.s);
  const hits: { objs: HitObj[]; floors: FloorHit[] } = { objs: [], floors: [] };
  const x = prepare(cv, fit.w, fit.h);
  if (!x) return { view: V, hits };
  const { r0, r1, c0, c1 } = fit.area;
  const cells: Cell[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells.push([r, c, W.type(r, c)]);
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const im = blocksFor(cam);
  drawGround(x, V, im, cells, fit.ring === 1, hits.floors);
  drawContact(x, V, W, cells);
  drawFlat(x, V, W);
  const items = upright(V, W, im, cells, hits.objs).sort((a, b) => a.k - b.k);
  for (const it of items) it.draw(x);
  // Pfeile liegen obenauf, damit Figur und Mauern sie nie verdecken
  for (const a of W.arrows)
    poly(x, flatPts(V, arrowPoly(a.r, a.c, a.d), 0.03), ARROW_FILL[a.kind], INK, LINE.arrow * V.s);
  return { view: V, hits };
}
