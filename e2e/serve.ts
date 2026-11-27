// Statischer Server für die fertige Seite (dist/) – für den Smoke-Test im Browser, ohne Astro.
// Ordner liefern ihre index.html, Unbekanntes die 404-Seite mit Status 404 (wie GitHub Pages).
// Für den Test der App-Updates (e2e/pwa-update.spec.ts) gibt es zwei Fassungen der Seite: den Build in dist/ und eine
// daraus abgeleitete zweite (e2e/versions.ts). Mit dem Cookie `ks-version=2` liefert der Server einem Browser-Kontext
// die zweite, so als wäre eine neue Fassung live gegangen – je Kontext, damit Tests parallel laufen. Ohne Cookie dist/.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { VERSIONS } from './versions-dirs.ts';

const PORT = Number(process.env.PORT ?? 4321);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

/** Ordner der Fassung, die dieser Browser-Kontext sehen soll (Cookie `ks-version`), sonst dist/ */
function root(req: IncomingMessage): string {
  const n = /(?:^|;\s*)ks-version=(\w+)/.exec(req.headers.cookie ?? '')?.[1];
  return (n && VERSIONS[n]) || VERSIONS['1']!;
}

async function serve(req: IncomingMessage, res: ServerResponse) {
  let path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (path.includes('..')) path = '/';
  if (path.endsWith('/')) path += 'index.html';
  const dir = root(req);
  try {
    const body = await readFile(join(dir, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(await readFile(join(dir, '404.html')).catch(() => 'Nicht gefunden'));
  }
}

createServer((req, res) => void serve(req, res)).listen(PORT, () =>
  console.log(`${VERSIONS['1']}/ auf http://localhost:${PORT}`),
);
