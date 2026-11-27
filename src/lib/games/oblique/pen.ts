// Pen: die schmale Teilmenge von CanvasRenderingContext2D, gegen die die Textur-Zeichner arbeiten. Im Browser ist der
// Pen der Kontext einer Canvas, beim Build schreibt svgPen (svg-pen.ts) dieselben Befehle als SVG.

/** Farbverlauf, wie ihn createLinearGradient liefert */
export interface PenGradient {
  addColorStop(offset: number, color: string): void;
}

/** Füllung oder Linie: eine CSS-Farbe oder ein Verlauf des Pens (im Browser auch alles, was die Canvas kennt) */
export type PenStyle = string | PenGradient | object;

export interface Pen {
  fillStyle: PenStyle;
  strokeStyle: PenStyle;
  lineWidth: number;
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'bevel' | 'miter' | 'round';
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  /** fehlt in alten Browsern; die Zeichner fallen dann auf rect zurück */
  roundRect?(x: number, y: number, w: number, h: number, radii: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): PenGradient;
}
