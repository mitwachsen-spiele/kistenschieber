import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { makeCamera } from '../games/oblique/camera';
import { kiste } from '../games/oblique/textures';
import { type BlockIcon, blockBox, blockIconSvg, iconIco, iconPng } from './icon';

const CRATE: BlockIcon = {
  faces: { top: kiste(), side: kiste({ brace: true }) },
  cam: makeCamera(20, 50),
  from: '#8dd0ee',
  to: '#3f8fc2',
  radius: 0.22,
  fill: 0.62,
  dy: 0.02,
};

/** Farbe eines Pixels (r, g, b, a) */
async function pixel(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [...data.subarray(i, i + info.channels)];
}

describe('Icon: Kiste auf Wasserblau', () => {
  it('ist ein abgerundetes Quadrat mit Verlauf von oben nach unten und der Kiste darüber', () => {
    const svg = blockIconSvg(100, CRATE);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="100" height="100" viewBox="0 0 100 100">/);
    expect(svg).toContain('<stop offset="0" stop-color="#8dd0ee"/><stop offset="1" stop-color="#3f8fc2"/>');
    expect(svg).toContain('<rect width="100" height="100" rx="22" ry="22" fill="url(#i-bg)"/>');
    expect(svg).toContain('id="i-kiste"');
    expect(svg).toContain('id="i-kiste-strebe"');
    expect(blockIconSvg(100, { ...CRATE, radius: 0 })).toContain('rx="0" ry="0"');
  });

  it('die Kiste ist 62 % breit, mittig und 2 % nach unten versetzt', () => {
    const box = blockBox(CRATE);
    expect(box.w).toBeCloseTo(0.62);
    expect(box.x).toBeCloseTo(0.19);
    expect(box.y + box.h / 2).toBeCloseTo(0.52);
    expect(box.h).toBeGreaterThan(box.w); // die Kiste von schräg oben ist höher als breit
    const svg = blockIconSvg(200, CRATE);
    expect(svg).toMatch(/<svg x="38" y="[\d.]+" width="124" height="[\d.]+" viewBox="0 0 [\d.]+ [\d.]+">/);
  });

  it('rastert in der gewünschten Größe: Ecken frei, Mitte Kiste, Rand oben Wasserblau', async () => {
    const png = await iconPng(64, CRATE);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([64, 64]);
    expect((await pixel(png, 0, 0))[3]).toBe(0); // abgerundete Ecke durchsichtig
    const top = await pixel(png, 32, 1);
    expect(top[2]).toBeGreaterThan(top[0]! + 60); // blau
    const mid = await pixel(png, 32, 34);
    expect(mid[3]).toBe(255);
    expect(mid).not.toEqual(top);
    const square = await iconPng(64, { ...CRATE, radius: 0 });
    expect((await pixel(square, 0, 0))[3]).toBe(255);
  });

  it('packt ein 32×32-PNG in einen gültigen ICO-Container', async () => {
    const ico = await iconIco(CRATE);
    expect([ico.readUInt16LE(2), ico.readUInt16LE(4), ico[6], ico[7]]).toEqual([1, 1, 32, 32]);
    expect(ico.readUInt32LE(14)).toBe(ico.length - 22);
    expect(ico.subarray(22, 26).toString('latin1')).toBe('\x89PNG');
  });
});
