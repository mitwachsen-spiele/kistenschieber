// Pen als SVG: dieselben Zeichenbefehle wie auf der Canvas, nur als SVG-Text. Damit entstehen App-Symbol, Favicon
// und Vorschaubild beim Build aus genau den Zeichnern, die das Spiel im Browser benutzt (kein Headless-Browser).
// Rein und browser-sicher; sharp rastert das Ergebnis erst in den Seiten unter src/pages.
import type { Camera } from './camera';
import { IS } from './camera';
import type { Pen, PenGradient, PenStyle } from './pen';
import { type BlockFaces, TEX, type Texture, paint } from './textures';

const num = (n: number): string => String(Math.round(n * 1000) / 1000);

class SvgGradient implements PenGradient {
  readonly stops: [number, string][] = [];
  emitted = false;
  constructor(
    readonly id: string,
    readonly from: readonly [number, number],
    readonly to: readonly [number, number],
  ) {}
  addColorStop(offset: number, color: string): void {
    this.stops.push([offset, color]);
  }
}

/** CSS-Farbe als SVG-Farbe und Deckkraft (rgba wird zu rgb und opacity, das versteht jeder SVG-Leser) */
export function svgColor(css: string): { color: string; opacity: number } {
  const m = /^rgba\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/.exec(css.trim());
  if (!m) return { color: css, opacity: 1 };
  return { color: `rgb(${m[1]},${m[2]},${m[3]})`, opacity: Number(m[4]) };
}

interface State {
  fillStyle: PenStyle;
  strokeStyle: PenStyle;
  lineWidth: number;
  lineCap: Pen['lineCap'];
  lineJoin: Pen['lineJoin'];
  /** in diesem Zustand geöffnete Clip-Gruppen */
  groups: number;
}

/** Zeichnet gegen den Pen und gibt das Ergebnis als SVG-Bruchstück (defs + Inhalt) zurück */
export class SvgPen implements Pen {
  fillStyle: PenStyle = '#000000';
  strokeStyle: PenStyle = '#000000';
  lineWidth = 1;
  lineCap: Pen['lineCap'] = 'butt';
  lineJoin: Pen['lineJoin'] = 'miter';
  private groups = 0;
  private d: string[] = [];
  private readonly stack: State[] = [];
  private readonly defs: string[] = [];
  private readonly out: string[] = [];
  private ids = 0;

  constructor(private readonly prefix = 'p') {}

  private id(kind: string): string {
    return `${this.prefix}-${kind}${this.ids++}`;
  }

  save(): void {
    const { fillStyle, strokeStyle, lineWidth, lineCap, lineJoin, groups } = this;
    this.stack.push({ fillStyle, strokeStyle, lineWidth, lineCap, lineJoin, groups });
    this.groups = 0;
  }

  restore(): void {
    const s = this.stack.pop();
    if (!s) return;
    for (; this.groups > 0; this.groups--) this.out.push('</g>');
    Object.assign(this, s);
  }

  beginPath(): void {
    this.d = [];
  }
  closePath(): void {
    this.d.push('Z');
  }
  moveTo(x: number, y: number): void {
    this.d.push(`M${num(x)} ${num(y)}`);
  }
  lineTo(x: number, y: number): void {
    this.d.push(`L${num(x)} ${num(y)}`);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.d.push(`Q${num(cpx)} ${num(cpy)} ${num(x)} ${num(y)}`);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.d.push(`M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z`);
  }
  roundRect(x: number, y: number, w: number, h: number, radii: number): void {
    const r = Math.max(0, Math.min(radii, w / 2, h / 2));
    const a = (dx: number, dy: number) => `a${num(r)} ${num(r)} 0 0 1 ${num(dx)} ${num(dy)}`;
    this.d.push(
      `M${num(x + r)} ${num(y)}h${num(w - 2 * r)}${a(r, r)}v${num(h - 2 * r)}${a(-r, r)}h${num(2 * r - w)}${a(-r, -r)}v${num(2 * r - h)}${a(r, -r)}Z`,
    );
  }
  /** Bogen im Uhrzeigersinn (wie die Canvas ohne anticlockwise); ein voller Kreis wird zu zwei Halbbögen */
  arc(x: number, y: number, radius: number, start: number, end: number): void {
    const at = (t: number) => `${num(x + Math.cos(t) * radius)} ${num(y + Math.sin(t) * radius)}`;
    const sweep = Math.min(end - start, Math.PI * 2);
    this.d.push(`${this.d.length ? 'L' : 'M'}${at(start)}`);
    const parts = sweep >= Math.PI * 2 ? [start + Math.PI, start + Math.PI * 2] : [start + sweep];
    let from = start;
    for (const t of parts) {
      this.d.push(`A${num(radius)} ${num(radius)} 0 ${t - from > Math.PI ? 1 : 0} 1 ${at(t)}`);
      from = t;
    }
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): PenGradient {
    return new SvgGradient(this.id('g'), [x0, y0], [x1, y1]);
  }

  private paintOf(style: PenStyle, kind: 'fill' | 'stroke'): string {
    if (style instanceof SvgGradient) {
      if (!style.emitted) {
        const stops = style.stops.map(([o, c]) => {
          const { color, opacity } = svgColor(c);
          return `<stop offset="${num(o)}" stop-color="${color}"${opacity < 1 ? ` stop-opacity="${opacity}"` : ''}/>`;
        });
        this.defs.push(
          `<linearGradient id="${style.id}" gradientUnits="userSpaceOnUse" x1="${num(style.from[0])}" y1="${num(style.from[1])}" x2="${num(style.to[0])}" y2="${num(style.to[1])}">${stops.join('')}</linearGradient>`,
        );
        style.emitted = true;
      }
      return `${kind}="url(#${style.id})"`;
    }
    if (typeof style !== 'string') throw new TypeError('svgPen kennt nur Farben und eigene Verläufe');
    const { color, opacity } = svgColor(style);
    return `${kind}="${color}"${opacity < 1 ? ` ${kind}-opacity="${opacity}"` : ''}`;
  }

  private strokeAttrs(): string {
    const cap = this.lineCap === 'butt' ? '' : ` stroke-linecap="${this.lineCap}"`;
    const join = this.lineJoin === 'miter' ? '' : ` stroke-linejoin="${this.lineJoin}"`;
    return `fill="none" ${this.paintOf(this.strokeStyle, 'stroke')} stroke-width="${num(this.lineWidth)}"${cap}${join}`;
  }

  fill(): void {
    if (this.d.length) this.out.push(`<path d="${this.d.join('')}" ${this.paintOf(this.fillStyle, 'fill')}/>`);
  }
  stroke(): void {
    if (this.d.length) this.out.push(`<path d="${this.d.join('')}" ${this.strokeAttrs()}/>`);
  }
  /** Alles Folgende bis zum nächsten restore wird auf den aktuellen Pfad beschnitten */
  clip(): void {
    const id = this.id('c');
    this.defs.push(`<clipPath id="${id}"><path d="${this.d.join('')}"/></clipPath>`);
    this.out.push(`<g clip-path="url(#${id})">`);
    this.groups++;
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.out.push(
      `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" ${this.paintOf(this.fillStyle, 'fill')}/>`,
    );
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.out.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" ${this.strokeAttrs()}/>`);
  }

  /** Verläufe und Clip-Pfade */
  defsMarkup(): string {
    return this.defs.join('');
  }
  /** Gezeichneter Inhalt; offene Clip-Gruppen werden geschlossen */
  contentMarkup(): string {
    let open = this.groups + this.stack.reduce((n, s) => n + s.groups, 0);
    const tail: string[] = [];
    for (; open > 0; open--) tail.push('</g>');
    return this.out.join('') + tail.join('');
  }
}

export const svgPen = (prefix?: string): SvgPen => new SvgPen(prefix);

export interface SvgBlock {
  readonly width: number;
  readonly height: number;
  readonly defs: string;
  readonly body: string;
}

/**
 * Ein Block in der schrägen Ansicht wie isoBlock im Entwurf: Deckel, Vorderseite (+j) und rechte Seite (+i) je per
 * matrix() auf 8 × rows Einheiten gelegt, darüber eine Tönung (oben +6 % Weiß, vorn 10 %, rechts 28 % Schwarz).
 * Niedrige Blöcke (h < 1) zeigen nur die oberen Zeilen der Seitentextur. Größe in px bei Maßstab 1.
 */
export function isoBlock(cam: Camera, faces: BlockFaces, h = 1, prefix = 'b'): SvgBlock {
  const { CS, SN, KY, ZS, IW, IT } = cam;
  const rows = Math.round(8 * h);
  const u = IS / 8;
  const textures: string[] = [];
  const idOf = new Map<Texture, string>();
  for (const t of [faces.top, faces.side]) {
    if (idOf.has(t)) continue;
    const id = `${prefix}-${t.name}`;
    const pen = svgPen(id);
    paint(pen, t);
    idOf.set(t, id);
    textures.push(`${pen.defsMarkup()}<g id="${id}">${pen.contentMarkup()}</g>`);
  }
  const list: [Texture, number[], string, number][] = [
    [faces.top, [CS * u, SN * u * KY, -SN * u, CS * u * KY, SN * IS, 0], 'rgba(255,255,255,.06)', 8],
    [faces.side, [CS * u, SN * u * KY, 0, ZS / 8, 0, CS * IS * KY], 'rgba(0,0,0,.10)', rows],
    [faces.side, [-SN * u, CS * u * KY, 0, ZS / 8, IW, SN * IS * KY], 'rgba(0,0,0,.28)', rows],
  ];
  const clips: string[] = [];
  const body = list.map(([t, m, tint, n], f) => {
    const clip = `${prefix}-face${f}`;
    clips.push(`<clipPath id="${clip}"><rect width="8" height="${n}"/></clipPath>`);
    const { color, opacity } = svgColor(tint);
    return (
      `<g transform="matrix(${m.map(num).join(' ')})">` +
      `<g clip-path="url(#${clip})"><use href="#${idOf.get(t)}" transform="scale(${num(8 / TEX)})"/></g>` +
      `<rect width="8" height="${n}" fill="${color}" fill-opacity="${opacity}"/></g>`
    );
  });
  return { width: IW, height: IT + ZS * h, defs: textures.join('') + clips.join(''), body: body.join('') };
}

/** Ein Block als eigenständiges SVG-Dokument (für sharp) */
export function isoBlockSvg(cam: Camera, faces: BlockFaces, h = 1, prefix = 'b'): string {
  const b = isoBlock(cam, faces, h, prefix);
  const w = num(b.width);
  const hh = num(b.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}"><defs>${b.defs}</defs>${b.body}</svg>`;
}
