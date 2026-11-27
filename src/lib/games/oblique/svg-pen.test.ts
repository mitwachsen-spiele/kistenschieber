import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { makeCamera } from './camera';
import { SvgPen, isoBlock, isoBlockSvg, svgColor, svgPen } from './svg-pen';
import { kai, kiste, klinker, granit, paint, wasser } from './textures';

/**
 * Kleine XML-Prüfung: nur Elemente mit Attributen in doppelten Anführungszeichen, jedes geöffnete Element wird
 * geschlossen, kein Text außerhalb, ids eindeutig, jeder Verweis url(#…) und href="#…" zeigt auf eine vorhandene id.
 */
function checkXml(xml: string): { tags: string[]; ids: Set<string> } {
  const stack: string[] = [];
  const tags: string[] = [];
  const ids = new Set<string>();
  const refs: string[] = [];
  const token = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"<>]*")*)\s*(\/?)>/y;
  let at = 0;
  while (at < xml.length) {
    token.lastIndex = at;
    const m = token.exec(xml);
    if (!m) throw new Error(`kein gültiges Element bei ${at}: ${xml.slice(at, at + 40)}`);
    const [all, close, name, attrs, self] = m;
    at += all.length;
    if (close) {
      if (stack.pop() !== name) throw new Error(`</${name}> schließt nichts Offenes`);
      continue;
    }
    tags.push(name!);
    for (const [, k, v] of attrs!.matchAll(/([\w:-]+)="([^"]*)"/g)) {
      if (k === 'id') {
        if (ids.has(v!)) throw new Error(`id doppelt: ${v}`);
        ids.add(v!);
      }
      for (const [, ref] of v!.matchAll(/url\(#([^)]+)\)/g)) refs.push(ref!);
      if (k === 'href') refs.push(v!.replace(/^#/, ''));
    }
    if (!self) stack.push(name!);
  }
  if (stack.length) throw new Error(`nicht geschlossen: ${stack.join(', ')}`);
  for (const r of refs) if (!ids.has(r)) throw new Error(`Verweis ins Leere: #${r}`);
  return { tags, ids };
}

const cam = makeCamera(20, 50);
const CRATE = { top: kiste(), side: kiste({ brace: true }) };

describe('svgColor', () => {
  it('macht aus rgba() rgb() und Deckkraft, lässt andere Farben stehen', () => {
    expect(svgColor('rgba(255,240,220,.13)')).toEqual({ color: 'rgb(255,240,220)', opacity: 0.13 });
    expect(svgColor('rgba(0, 0, 0, 0.5)')).toEqual({ color: 'rgb(0,0,0)', opacity: 0.5 });
    expect(svgColor('#24527f')).toEqual({ color: '#24527f', opacity: 1 });
  });
});

describe('svgPen', () => {
  it('schreibt Pfade, Rechtecke, Bögen und Verläufe als SVG', () => {
    const p = svgPen('t');
    p.fillStyle = 'rgba(0,0,0,.25)';
    p.fillRect(1, 2, 3, 4);
    p.beginPath();
    p.moveTo(0, 0);
    p.lineTo(1, 1);
    p.quadraticCurveTo(2, 2, 3, 3);
    p.closePath();
    p.strokeStyle = '#fff6d2';
    p.lineWidth = 6.5;
    p.lineCap = 'round';
    p.lineJoin = 'round';
    p.stroke();
    const g = p.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#53a3d6');
    g.addColorStop(1, 'rgba(58,134,187,.5)');
    p.fillStyle = g;
    p.fillRect(0, 0, 64, 64);
    p.fillRect(0, 0, 1, 1);
    p.beginPath();
    p.arc(10, 10, 2, 0, Math.PI * 2);
    p.fill();
    p.beginPath();
    p.arc(10, 10, 2, 0, Math.PI / 2);
    p.lineTo(5, 5);
    p.stroke();
    p.strokeRect(1, 1, 2, 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${p.defsMarkup()}</defs>${p.contentMarkup()}</svg>`;
    checkXml(svg);
    expect(svg).toContain('<rect x="1" y="2" width="3" height="4" fill="rgb(0,0,0)" fill-opacity="0.25"/>');
    expect(svg).toContain('d="M0 0L1 1Q2 2 3 3Z"');
    expect(svg).toContain('stroke="#fff6d2" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"');
    // ein Verlauf, nur einmal in defs, mit Deckkraft am Stopp
    expect(svg.match(/<linearGradient /g)).toHaveLength(1);
    expect(svg).toContain('stop-opacity="0.5"');
    expect(svg).toContain('fill="url(#t-g0)"');
    // voller Kreis: zwei Halbbögen; Viertel: ein kleiner Bogen
    expect(svg).toContain('M12 10A2 2 0 0 1 8 10A2 2 0 0 1 12 10');
    expect(svg).toContain('M12 10A2 2 0 0 1 10 12L5 5');
  });

  it('rundet Rechtecke mit Bögen und klemmt den Radius', () => {
    const p = new SvgPen();
    p.beginPath();
    p.roundRect(0, 0, 10, 4, 3);
    p.fill();
    expect(p.contentMarkup()).toContain('M2 0h6a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v0a2 2 0 0 1 2 -2Z');
  });

  it('clip gilt bis restore; save/restore stellt Farben und Linien wieder her', () => {
    const p = svgPen('c');
    p.fillStyle = '#111111';
    p.save();
    p.beginPath();
    p.rect(0, 0, 5, 5);
    p.clip();
    p.fillStyle = '#222222';
    p.lineWidth = 9;
    p.fillRect(0, 0, 9, 9);
    p.restore();
    p.fillRect(0, 0, 1, 1);
    expect(p.fillStyle).toBe('#111111');
    expect(p.lineWidth).toBe(1);
    const out = p.contentMarkup();
    expect(out).toBe(
      '<g clip-path="url(#c-c0)"><rect x="0" y="0" width="9" height="9" fill="#222222"/></g><rect x="0" y="0" width="1" height="1" fill="#111111"/>',
    );
    expect(p.defsMarkup()).toBe('<clipPath id="c-c0"><path d="M0 0h5v5h-5Z"/></clipPath>');
    p.restore(); // ohne save: nichts
  });

  it('schließt beim Ausgeben offene Clip-Gruppen; leere Pfade zeichnen nichts', () => {
    const p = svgPen();
    p.beginPath();
    p.fill();
    p.stroke();
    p.save();
    p.rect(0, 0, 1, 1);
    p.clip();
    expect(p.contentMarkup()).toBe('<g clip-path="url(#p-c0)"></g>');
  });

  it('kennt nur Farben und eigene Verläufe', () => {
    const p = svgPen();
    p.fillStyle = {};
    expect(() => p.fillRect(0, 0, 1, 1)).toThrow(TypeError);
  });

  it('zeichnet jede Textur als gültiges SVG', () => {
    for (const t of [klinker, granit, kai, wasser, kiste({ ok: true, check: true }), CRATE.side]) {
      const p = svgPen(t.name);
      paint(p, t);
      checkXml(`<svg><defs>${p.defsMarkup()}</defs>${p.contentMarkup()}</svg>`);
    }
  });
});

describe('isoBlockSvg', () => {
  it('Kiste: gültiges SVG mit drei matrix()-Flächen und clipPath', () => {
    const svg = isoBlockSvg(cam, CRATE);
    const { tags } = checkXml(svg);
    expect(tags[0]).toBe('svg');
    expect(tags).toContain('clipPath');
    expect(svg.match(/transform="matrix\(/g)).toHaveLength(3);
    // die Strebe der Seiten clippt selbst; dazu je Fläche ein Clip auf 8 × rows
    expect(svg).toContain('<clipPath id="b-face0"><rect width="8" height="8"/></clipPath>');
    // Tönung oben +6 % Weiß, vorn 10 %, rechts 28 % Schwarz
    expect(svg).toContain('fill="rgb(255,255,255)" fill-opacity="0.06"');
    expect(svg).toContain('fill="rgb(0,0,0)" fill-opacity="0.1"');
    expect(svg).toContain('fill="rgb(0,0,0)" fill-opacity="0.28"');
    // Seitentextur einmal gezeichnet, zweimal benutzt
    expect(svg.match(/<use /g)).toHaveLength(3);
    expect(svg).toContain('#24527f');
  });

  it('Größe wie isoBlock im Entwurf: IW × (IT + ZS·h), Matrizen aus der Kamera', () => {
    const b = isoBlock(cam, CRATE);
    expect(b.width).toBeCloseTo(cam.IW, 12);
    expect(b.height).toBeCloseTo(cam.IT + cam.ZS, 12);
    const u = (40 * Math.SQRT2) / 8;
    const n = (x: number) => String(Math.round(x * 1000) / 1000);
    expect(b.body).toContain(
      `matrix(${[cam.CS * u, cam.SN * u * cam.KY, -cam.SN * u, cam.CS * u * cam.KY, cam.SN * 40 * Math.SQRT2, 0].map(n).join(' ')})`,
    );
  });

  it('niedrige Blöcke (Mauer 0,5) zeigen nur die oberen 4 Zeilen der Seite', () => {
    const b = isoBlock(cam, { top: kai, side: granit }, 0.5, 'w');
    expect(b.height).toBeCloseTo(cam.IT + cam.ZS * 0.5, 12);
    expect(b.defs).toContain('<clipPath id="w-face1"><rect width="8" height="4"/></clipPath>');
    checkXml(`<svg><defs>${b.defs}</defs>${b.body}</svg>`);
  });

  it('sharp rastert die Kiste: blauer Rahmen, Bretter in der Mitte des Deckels', async () => {
    const svg = isoBlockSvg(cam, CRATE);
    const { data, info } = await sharp(Buffer.from(svg))
      .resize(200)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => {
      const i = (Math.round(y) * info.width + Math.round(x)) * 4;
      return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
    };
    const k = info.width / cam.IW;
    // Mitte eines Bretts auf dem Deckel: Projektion von (0,5 | 0,42) bei z = Oberkante,
    // Ursprung bei SN·IS. Texturpunkt y ≈ 27 liegt mitten in Brett 2, nicht auf einer Fuge
    // (die Deckelmitte y = 32 träfe genau die Fuge zwischen Brett 2 und 3).
    const [u, v] = [0.5, 0.42];
    const top = [
      (cam.SN * 40 * Math.SQRT2 + (u * cam.CS - v * cam.SN) * 40 * Math.SQRT2) * k,
      (u * cam.SN + v * cam.CS) * 40 * Math.SQRT2 * cam.KY * k,
    ];
    const [r, g, b, a] = px(top[0]!, top[1]!);
    expect(a).toBe(255);
    // helles Holz: rot > grün > blau
    expect(r).toBeGreaterThan(180);
    expect(r).toBeGreaterThan(g!);
    expect(g).toBeGreaterThan(b!);
    // Ecke oben links ist leer
    expect(px(1, 1)[3]).toBe(0);
  });
});
