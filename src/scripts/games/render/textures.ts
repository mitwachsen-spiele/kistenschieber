// Feine Texturen im Browser: jede Textur einmal auf eine Canvas von 128 × 128 px gezeichnet (Zeichenraum 64 × 64,
// scale 2), wie tex() im Entwurf. Die Zeichner selbst sind rein (lib/games/oblique/textures.ts).
import { TEX, type Texture, paint } from '../../../lib/games/oblique/textures';

/** Kantenlänge der Textur-Canvas in px */
export const TEX_PX = 128;

const cache = new Map<Texture, HTMLCanvasElement>();

export function textureCanvas(t: Texture): HTMLCanvasElement {
  const hit = cache.get(t);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = TEX_PX;
  const x = c.getContext('2d');
  if (x) {
    x.scale(TEX_PX / TEX, TEX_PX / TEX);
    paint(x, t);
  }
  cache.set(t, c);
  return c;
}
