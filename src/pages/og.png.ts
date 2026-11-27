// Vorschaubild für Messenger & Co. (og:image, 1200 × 630): das App-Symbol im Breitformat, die Kiste auf Wasserblau
// (Verlauf von oben nach unten), beim Build mit sharp in ein PNG gerendert.
import sharp from 'sharp';
import { isoBlock } from '../lib/games/oblique/svg-pen';
import { appIcon } from '../data/app-icon';

const W = 1200;
const H = 630;

export async function GET() {
  const { faces, cam, from, to } = appIcon('any');
  const b = isoBlock(cam, faces, 1, 'og');
  // Die Kiste 70 % so hoch wie das Bild, mittig und wie im Symbol etwas tiefer
  const h = H * 0.7;
  const w = (h * b.width) / b.height;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="og-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>${b.defs}</defs>
<rect width="${W}" height="${H}" fill="url(#og-bg)"/>
<svg x="${(W - w) / 2}" y="${(H - h) / 2 + H * 0.02}" width="${w}" height="${h}" viewBox="0 0 ${b.width} ${b.height}">${b.body}</svg>
</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
