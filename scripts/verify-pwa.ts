// Guard-Gate nach dem Build (Teil von npm run verify): Das Spiel als App – installierbar und ohne Netz spielbar.
// Manifest und Icons stimmen, jede Seite verweist auf das Manifest, und der Service Worker des Spiels speichert alles,
// was die Spielseite braucht (auch die nachgeladenen Teile: Ohne Netz müssen Konfetti und Anmeldung aus dem Speicher
// kommen), nur von der eigenen Seite, in einer Version, die zum Inhalt passt, und alles zusammen im Budget. Die
// Ausgabe zeigt Kern und Nachgeladenes getrennt. Logik und Tests: scripts/pwa.ts, scripts/pwa.test.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Script } from 'node:vm';
import {
  checkManifest,
  checkManifestLinks,
  checkPrecacheSize,
  checkServiceWorker,
  parseServiceWorker,
  precacheBytes,
  precacheParts,
  type PwaOptions,
} from './pwa.ts';
import { distFile } from '../src/lib/pwa/precache.ts';
import { SERVICE_WORKER } from '../src/data/pwa.ts';
import { SITE } from '../src/data/site.ts';

const DIST = 'dist';
/**
 * Höchstens so viele Bytes speichert der Service Worker vorab – jedes Gerät lädt sie mit jeder neuen Version ganz.
 * Grenze gemessen + 10 %. Angehoben wird erst, wenn weniger als 3 % Luft bleiben, dann wieder auf gemessen + 10 %, mit
 * einem Satz Begründung in der Commit-Nachricht.
 */
const PRECACHE_BUDGET = 456 * 1024; // gemessen 414,5 KiB (424420 B, Schritt 9)
const OPTS: PwaOptions = { origin: SITE.url, manifest: '/manifest.webmanifest', sw: SERVICE_WORKER };

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(join(dir, e.name)) : [join(dir, e.name)],
  );
const read = (path: string) => {
  try {
    return readFileSync(join(DIST, path));
  } catch {
    return null;
  }
};

const all = filesIn(DIST).map((f) => relative(DIST, f));
const pages: [string, string][] = all
  .filter((f) => f.endsWith('.html'))
  .map((f) => [f, readFileSync(join(DIST, f), 'utf8')]);
// Nur die Spielseite lädt JavaScript (die 404-Seite keins): Jede JavaScript-Datei gehört zum Spiel und muss offline da sein
const scripts = all.filter((f) => /\.m?js$/.test(f) && f !== distFile(SERVICE_WORKER.url)).map((f) => `/${f}`);

const swFile = distFile(SERVICE_WORKER.url);
const precached = parseServiceWorker(read(swFile)?.toString('utf8') ?? '')?.files ?? [];
const bytes = precacheBytes(precached, read);

const problems = [
  ...checkServiceWorker(read, scripts, OPTS),
  ...checkPrecacheSize(precached, read, PRECACHE_BUDGET),
  ...checkManifest(read, OPTS),
  ...checkManifestLinks(pages, OPTS.manifest),
];
try {
  new Script(readFileSync(join(DIST, swFile), 'utf8'));
} catch (e) {
  problems.push(`${SERVICE_WORKER.url}: kein gültiges JavaScript (${(e as Error).message})`);
}

if (problems.length) {
  console.error(`App-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
const exact = (n: number) => `${kib(n)} (${n} B)`;
console.log(`✓ App-Gate: Manifest und Icons gültig, Service Worker speichert alles für ${SERVICE_WORKER.entry}`);
console.log(`  vorab gespeichert: ${precached.length} Dateien, ${exact(bytes)} von ${kib(PRECACHE_BUDGET)} Budget`);
for (const part of precacheParts(precached, read)) console.log(`    ${part.name}: ${kib(part.bytes)}`);
