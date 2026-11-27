import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blockBox } from '../lib/voxel/icon';
import { appIcon } from './app-icon';
import { KAJE_BLOCKS } from './games/kaje';
import { APP, APP_ICONS, ICON_LOOK, SERVICE_WORKER, WATER_1, WATER_2 } from './pwa';
import { THEME_LIGHT } from './site';

const token = (name: string) =>
  readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8').match(
    new RegExp(`--${name}:\\s*(#[0-9a-f]+)`, 'i'),
  )?.[1];

describe('Das Spiel als App', () => {
  it('nimmt das Wasserblau aus tokens.css, für Browserleiste und Hintergrund', () => {
    expect(WATER_1).toBe(token('water-1'));
    expect(WATER_2).toBe(token('water-2'));
    expect(APP.themeColor).toBe(WATER_1);
    expect(APP.backgroundColor).toBe(WATER_1);
    expect(APP.themeColor).toBe(THEME_LIGHT);
  });

  it('heißt Kistenschieber, kurz Kisten, auf Deutsch', () => {
    expect(APP).toMatchObject({ name: 'Kistenschieber', shortName: 'Kisten', lang: 'de', display: 'standalone' });
    expect(APP.description.length).toBeLessThanOrEqual(160);
  });

  it('startet im Spiel; der Service Worker steuert die ganze Adresse', () => {
    expect(APP.startUrl).toBe(SERVICE_WORKER.entry);
    expect(APP.startUrl.startsWith(APP.scope)).toBe(true);
    expect(SERVICE_WORKER.url.startsWith(SERVICE_WORKER.scope)).toBe(true);
    expect(SERVICE_WORKER).toMatchObject({ url: '/sw.js', scope: '/', prefix: 'kistenschieber-' });
  });

  it('hat Icons in 192 und 512 und ein maskierbares in 512', () => {
    expect(APP_ICONS.map((i) => `${i.size} ${i.purpose}`)).toEqual(['192 any', '512 any', '512 maskable']);
  });

  it('Symbol wie im Entwurf: Kiste des Kais im Standard-Blickwinkel, Radius 22 %, 62 % breit, 2 % tiefer', () => {
    expect(ICON_LOOK.any).toEqual({ radius: 0.22, fill: 0.62, dy: 0.02 });
    expect(appIcon('any')).toMatchObject({ faces: KAJE_BLOCKS.crate, from: WATER_1, to: WATER_2, ...ICON_LOOK.any });
    expect([appIcon('any').cam.yaw, appIcon('any').cam.tilt]).toEqual([20, 50]);
    expect(appIcon('maskable').radius).toBe(0);
  });

  it('die Kiste des maskierbaren Icons bleibt mit ihrem ganzen Rahmen in der sicheren Zone (Kreis, 80 %)', () => {
    const box = blockBox(appIcon('maskable'));
    const corners = [
      [box.x, box.y],
      [box.x + box.w, box.y + box.h],
    ];
    for (const [x, y] of corners) expect(Math.hypot(x! - 0.5, y! - 0.5)).toBeLessThanOrEqual(0.4);
  });
});
