// Seiten- und App-Icon: ein Block der schrägen Ansicht (im Spiel die Kiste) auf einer Fläche mit Verlauf. Gezeichnet
// mit denselben Zeichnern wie im Browser (svg-pen.ts), als SVG für favicon.svg und gerastert (sharp) für favicon.ico,
// apple-touch-icon und die Icons der App. Generisch: Block, Kamera, Farben und Maße kommen als Parameter.
import sharp from 'sharp';
import type { Camera } from '../games/oblique/camera';
import { isoBlock } from '../games/oblique/svg-pen';
import type { BlockFaces } from '../games/oblique/textures';

const num = (n: number): string => String(Math.round(n * 1000) / 1000);

export type BlockIcon = {
  faces: BlockFaces; // Texturen des Blocks
  cam: Camera; // Blickwinkel
  from: string; // Farbe oben
  to: string; // Farbe unten
  radius: number; // Rundung der Ecken als Anteil der Kante (0: eckig, etwa für maskable Icons)
  fill: number; // Breite des Blocks als Anteil der Kante
  dy: number; // Versatz des Blocks nach unten als Anteil der Kante
};

/** Lage des Blocks im Icon als Anteile der Kante: links, oben, Breite, Höhe */
export function blockBox(icon: BlockIcon): { x: number; y: number; w: number; h: number } {
  const b = isoBlock(icon.cam, icon.faces);
  const w = icon.fill;
  const h = (w * b.height) / b.width;
  return { x: (1 - w) / 2, y: (1 - h) / 2 + icon.dy, w, h };
}

/** Das Icon als SVG mit `size` × `size` Pixeln */
export function blockIconSvg(size: number, icon: BlockIcon): string {
  const b = isoBlock(icon.cam, icon.faces, 1, 'i');
  const box = blockBox(icon);
  const r = num(size * icon.radius);
  const [x, y, w, h] = [box.x, box.y, box.w, box.h].map((v) => num(v * size));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs><linearGradient id="i-bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${icon.from}"/><stop offset="1" stop-color="${icon.to}"/></linearGradient>` +
    `${b.defs}</defs>` +
    `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#i-bg)"/>` +
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${num(b.width)} ${num(b.height)}">${b.body}</svg>` +
    `</svg>`
  );
}

/** Das Icon als quadratisches PNG */
export function iconPng(size: number, icon: BlockIcon): Promise<Buffer> {
  return sharp(Buffer.from(blockIconSvg(size, icon)))
    .png()
    .toBuffer();
}

/** favicon.ico mit eingebettetem 32×32-PNG (ICO-Container: 6 Byte Kopf, 16 Byte Verzeichniseintrag, Bilddaten). */
export async function iconIco(icon: BlockIcon): Promise<Buffer> {
  const png = await iconPng(32, icon);
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); // reserviert
  head.writeUInt16LE(1, 2); // Typ: Icon
  head.writeUInt16LE(1, 4); // ein Bild
  head.writeUInt8(32, 6); // Breite
  head.writeUInt8(32, 7); // Höhe
  head.writeUInt8(0, 8); // keine Farbpalette
  head.writeUInt8(0, 9); // reserviert
  head.writeUInt16LE(1, 10); // Farbebenen
  head.writeUInt16LE(32, 12); // Bit pro Pixel
  head.writeUInt32LE(png.length, 14); // Größe der Bilddaten
  head.writeUInt32LE(22, 18); // Beginn der Bilddaten
  return Buffer.concat([head, png]);
}
