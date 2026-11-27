// Vorbereitung des Browser-Tests (globalSetup in playwright.config.ts): leitet aus dem Build in dist/ eine zweite
// Fassung der Seite ab (.e2e/v2), so als wäre der nachgeladene Teil ks-menu (Konfetti) neu gebaut worden. Die Datei
// bekommt neuen Inhalt und einen neuen Namen, die alte gibt es auf dem Server nicht mehr, der Verweis im Spiel zeigt auf
// die neue. Den Service Worker schreibt derselbe Code wie beim Build neu (src/integrations/service-worker.ts): neue
// Liste, neue Version. Kein zweiter Build und nichts Testspezifisches in der Seite. Der Test-Server (e2e/serve.ts)
// liefert die Fassung mit dem Cookie `ks-version=2`; geprüft in e2e/pwa-update.spec.ts.
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { writeServiceWorker } from '../src/integrations/service-worker';
import { CHUNK, VERSIONS } from './versions-dirs.ts';

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesIn(join(dir, e.name)) : [join(dir, e.name)],
  );

export default function deriveSecondVersion() {
  const v1 = VERSIONS['1']!;
  const v2 = VERSIONS['2']!;
  rmSync(v2, { recursive: true, force: true });
  cpSync(v1, v2, { recursive: true });
  const files = filesIn(v2).map((f) => relative(v2, f));
  const chunk = files.find((f) => CHUNK.test(f));
  if (!chunk) throw new Error(`Browser-Test: kein nachgeladenes ks-menu in ${v1} – erst npm run build`);
  const renamed = chunk.replace(/\.js$/, '-v2.js');
  writeFileSync(join(v2, renamed), readFileSync(join(v2, chunk), 'utf8') + '\n// Fassung 2\n');
  rmSync(join(v2, chunk));
  const [from, to] = [basename(chunk), basename(renamed)];
  for (const f of files.filter((f) => f !== chunk && /\.(html|js|css)$/.test(f))) {
    const text = readFileSync(join(v2, f), 'utf8');
    if (text.includes(from)) writeFileSync(join(v2, f), text.split(from).join(to));
  }
  const { version } = writeServiceWorker(v2);
  console.log(`Browser-Test: zweite Fassung in ${v2}, ${to}, Version ${version}`);
}
