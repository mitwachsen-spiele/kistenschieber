import { describe, expect, it } from 'vitest';
import { webManifest } from './manifest';

const APP = {
  name: 'Spiel',
  shortName: 'Spiel',
  description: 'Ein Spiel',
  lang: 'de',
  startUrl: '/spielen/',
  scope: '/',
  display: 'standalone',
  themeColor: '#79c7ea',
  backgroundColor: '#79c7ea',
} as const;

describe('Web-App-Manifest', () => {
  it('startet im Spiel, mit Farben und Icons, ohne die Drehung festzulegen', () => {
    const m = webManifest(APP, [
      { file: 'icon-192.png', size: 192, purpose: 'any' },
      { file: 'icon-maskable-512.png', size: 512, purpose: 'maskable' },
    ]);
    expect(m).toMatchObject({ id: '/spielen/', start_url: '/spielen/', scope: '/', lang: 'de', display: 'standalone' });
    expect(m).not.toHaveProperty('orientation');
    expect(m.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
  });
});
