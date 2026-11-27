// Blöcke im Browser: die drei sichtbaren Flächen eines Blocks per setTransform aus den Textur-Canvas zusammengesetzt
// (isoBlock im Entwurf), in vierfacher Auflösung, weich skaliert. Ein Satz Blöcke je Kamera; Drehen am Regler legt
// neue an, alte fallen aus dem kleinen Speicher.
import { IS, type Camera, type View } from '../../../lib/games/oblique/camera';
import type { BlockFaces } from '../../../lib/games/oblique/textures';
import { BLOCK_HEIGHT, KAJE_BLOCKS, type BlockKind } from '../../../data/games/kaje';
import { textureCanvas } from './textures';

/** Auflösung der Blockbilder (fein: 4) */
export const RES = 4;
/** So viele Kameras behält der Speicher */
const KEEP = 4;

export interface BlockImg {
  /** Höhe des Blocks in Zellen */
  readonly h: number;
  readonly img: HTMLCanvasElement;
}

export type Blocks = Readonly<Record<BlockKind, BlockImg>>;

/** Textur auf ein Feld von 8 × rows Einheiten; niedrige Blöcke zeigen nur die oberen Zeilen der Textur */
function paintFace(x: CanvasRenderingContext2D, tex: HTMLCanvasElement, rows: number) {
  x.drawImage(tex, 0, 0, tex.width, (tex.height * rows) / 8, 0, 0, 8, rows);
}

/** Bild eines Blocks der Höhe h: Deckel (+6 % Weiß), Vorderseite (−10 %), rechte Seite (−28 %) */
export function isoBlock(cam: Camera, faces: BlockFaces, h: number, res = RES): HTMLCanvasElement {
  const { CS, SN, KY, ZS, IW, IT } = cam;
  const rows = Math.round(8 * h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(IW * res));
  c.height = Math.ceil((IT + ZS * h) * res);
  const x = c.getContext('2d');
  if (!x) return c;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  const u = IS / 8;
  const top = textureCanvas(faces.top);
  const side = textureCanvas(faces.side);
  const list: [HTMLCanvasElement, readonly number[], string, number][] = [
    [top, [CS * u, SN * u * KY, -SN * u, CS * u * KY, SN * IS, 0], 'rgba(255,255,255,.06)', 8],
    [side, [CS * u, SN * u * KY, 0, ZS / 8, 0, CS * IS * KY], 'rgba(0,0,0,.10)', rows],
    [side, [-SN * u, CS * u * KY, 0, ZS / 8, IW, SN * IS * KY], 'rgba(0,0,0,.28)', rows],
  ];
  for (const [tex, m, sh, n] of list) {
    const [a = 0, b = 0, cc = 0, d = 0, e = 0, f = 0] = m;
    x.setTransform(res * a, res * b, res * cc, res * d, res * e, res * f);
    paintFace(x, tex, n);
    x.fillStyle = sh;
    x.fillRect(0, 0, 8, n);
  }
  return c;
}

const cache = new Map<string, Blocks>();

/** Alle Blöcke der Kaje für eine Kamera */
export function blocksFor(cam: Camera): Blocks {
  const hit = cache.get(cam.key);
  if (hit) return hit;
  const make = (kind: BlockKind): BlockImg => ({
    h: BLOCK_HEIGHT[kind],
    img: isoBlock(cam, KAJE_BLOCKS[kind], BLOCK_HEIGHT[kind]),
  });
  const blocks: Blocks = {
    floor: make('floor'),
    wall: make('wall'),
    crate: make('crate'),
    crateOk: make('crateOk'),
    ring: make('ring'),
  };
  cache.set(cam.key, blocks);
  for (const key of cache.keys()) if (cache.size > KEEP) cache.delete(key);
  return blocks;
}

/** Block mit linker hinterer Ecke (i, j) auf Höhe z0, verkleinert auf k (mittig) */
export function drawBlock(x: CanvasRenderingContext2D, V: View, b: BlockImg, i: number, j: number, z0: number, k = 1) {
  const off = (1 - k) / 2;
  const [px, py] = V.Q(i + off, j + off, z0 + k * b.h);
  const s = V.s * k;
  const { SN, IW, IT, ZS } = V.cam;
  x.drawImage(b.img, px - SN * IS * s, py, IW * s, (IT + ZS * b.h) * s);
}
