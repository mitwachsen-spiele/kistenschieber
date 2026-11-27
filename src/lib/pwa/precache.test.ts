import { describe, expect, it } from 'vitest';
import {
  cacheVersion,
  cssRefs,
  distFile,
  htmlRefs,
  jsRefs,
  manifestRefs,
  precacheList,
  sameOriginPath,
} from './precache';

const ORIGIN = 'https://www.example.de';
const enc = (s: string) => new TextEncoder().encode(s);

const SITE: Record<string, string> = {
  'spielen/index.html': `<!doctype html><link rel="stylesheet" href="/_astro/a.css">
    <link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/favicon.svg">
    <link rel="canonical" href="https://www.example.de/spielen/"><a href="/">Start</a>
    <meta property="og:image" content="/og.png"><script type="module" src="/_astro/game.js"></script>
    <img src="data:image/png;base64,AAA" alt=""><script src="https://cdn.example.com/x.js"></script>`,
  '_astro/a.css': '@font-face{src:url(/_astro/f.woff2) format("woff2"),url(./f.woff)}.x{background:url(data:x)}',
  '_astro/f.woff2': 'F2',
  '_astro/f.woff': 'F1',
  '_astro/game.js':
    'import{a}from"./shared.js";const t=()=>import(`./three.js`);new Audio("/games/stimme/a.m4a");"/nicht/da.png"',
  '_astro/shared.js': 'export const a=1',
  '_astro/three.js': 'class WebGLRenderer{}',
  'games/stimme/a.m4a': 'AUDIO',
  'manifest.webmanifest': JSON.stringify({ icons: [{ src: '/icon-192.png' }, { src: 7 }] }),
  'icon-192.png': 'PNG',
  'favicon.svg': '<svg/>',
  'index.html': '<script src="/_astro/home.js"></script>',
};
const read = (p: string) => (p in SITE ? enc(SITE[p]!) : null);

describe('Vorab speichern', () => {
  it('liest Verweise aus HTML, die der Browser lädt, aber keine Links, canonical oder og:image', () => {
    expect(htmlRefs(SITE['spielen/index.html']!)).toEqual([
      '/_astro/a.css',
      '/manifest.webmanifest',
      '/favicon.svg',
      '/_astro/game.js',
      'data:image/png;base64,AAA',
      'https://cdn.example.com/x.js',
    ]);
    expect(
      htmlRefs(
        '<img srcset="/a.webp 1x, /b.webp 2x" style="background:url(/c.png)"><style>.y{background:url("/d.png")}</style>',
      ),
    ).toEqual(['/a.webp', '/b.webp', '/c.png', '/d.png']);
  });

  it('liest url() und @import aus CSS', () => {
    expect(cssRefs('@import "/x.css";.a{background:url( \'/b.png\' )}')).toEqual(['/x.css', '/b.png']);
  });

  it('liest statische und nachträgliche Importe; Dateinamen in Zeichenketten nur als Kandidaten', () => {
    const refs = jsRefs(SITE['_astro/game.js']! + ';export*from"./re.js"');
    expect(refs.filter((r) => r.strict).map((r) => r.url)).toEqual(['./shared.js', './re.js', './three.js']);
    const loose = refs.filter((r) => !r.strict).map((r) => r.url);
    expect(loose).toEqual(expect.arrayContaining(['/games/stimme/a.m4a', '/nicht/da.png']));
    expect(jsRefs('"/spielen/";"/"').length).toBe(0);
  });

  it('liest Icons aus dem Manifest und übersteht kaputtes JSON', () => {
    expect(manifestRefs(SITE['manifest.webmanifest']!)).toEqual(['/icon-192.png']);
    expect(manifestRefs('{kaputt')).toEqual([]);
    expect(manifestRefs('{}')).toEqual([]);
  });

  it('nimmt nur Pfade der eigenen Seite', () => {
    expect(sameOriginPath('./b.js', '/_astro/a.js', ORIGIN)).toBe('/_astro/b.js');
    expect(sameOriginPath('https://www.example.de/x.png', '/', ORIGIN)).toBe('/x.png');
    expect(sameOriginPath('//cdn.example.com/x.js', '/', ORIGIN)).toBeNull();
    expect(sameOriginPath('data:abc', '/', ORIGIN)).toBeNull();
    expect(sameOriginPath('#oben', '/', ORIGIN)).toBeNull();
    expect(sameOriginPath('http://[kaputt', '/', ORIGIN)).toBeNull();
    expect(distFile('/spielen/')).toBe('spielen/index.html');
    expect(distFile('/_astro/a.js')).toBe('_astro/a.js');
  });

  it('sammelt alles, was die Spielseite braucht, auch Three.js und Aufnahmen – nichts von anderen Seiten', () => {
    const p = precacheList('/spielen/', read, ORIGIN);
    expect(p.files).toEqual([
      '/_astro/a.css',
      '/_astro/f.woff',
      '/_astro/f.woff2',
      '/_astro/game.js',
      '/_astro/shared.js',
      '/_astro/three.js',
      '/favicon.svg',
      '/games/stimme/a.m4a',
      '/icon-192.png',
      '/manifest.webmanifest',
      '/spielen/',
    ]);
    expect(p.missing).toEqual([]);
    expect(p.foreign).toEqual(['https://cdn.example.com/x.js']);
  });

  it('meldet fehlende Dateien und lässt Ausgenommenes weg', () => {
    const broken = (path: string) => (path === '_astro/shared.js' ? null : read(path));
    expect(precacheList('/spielen/', broken, ORIGIN).missing).toEqual(['/_astro/shared.js']);
    expect(precacheList('/spielen/', read, ORIGIN, ['/_astro/three.js']).files).not.toContain('/_astro/three.js');
  });

  it('ändert die Version mit jedem Inhalt, nicht mit der Reihenfolge', () => {
    const files = ['/_astro/a.css', '/spielen/'];
    const v = cacheVersion(files, read);
    expect(v).toMatch(/^[0-9a-f]{12}$/);
    expect(cacheVersion([...files].reverse(), read)).toBe(v);
    const changed = (path: string) => (path === '_astro/a.css' ? enc('.neu{}') : read(path));
    expect(cacheVersion(files, changed)).not.toBe(v);
    expect(cacheVersion(['/fehlt.js'], read)).toMatch(/^[0-9a-f]{12}$/);
  });
});
