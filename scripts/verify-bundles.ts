// Guard-Gate nach dem Build (Teil von npm run verify): Die Seiten bleiben schnell und ohne Ballast.
// Die Spielseite (index.html) lädt das Spiel unter einem Budget mit Luft (gemessen + 10 %); Three.js und WebGL gibt es
// nirgends, das Spiel zeichnet mit Canvas 2D. Alle anderen Seiten bleiben unter 32 KB, ohne Spielcode und ohne die
// Anmeldung eines Service Workers. Vorbild: scripts/verify-bundles.ts in mitwachsen-spiele/weltenbummler.
// Logik und Tests: scripts/bundles.ts, scripts/bundles.test.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, type Rule, type Usage } from './bundles.ts';

const DIST = 'dist';
// Spielcode und die Anmeldung eines Service Workers: nur auf der Spielseite
const GAME_CODE = /ks-kistenschieber|serviceWorker/;
// Three.js und WebGL: nirgends
const THREE = /WebGLRenderer|three\.module|webgl/;

export const RULES: Rule[] = [
  { name: 'Spiel', pages: /^index\.html$/, budget: 47 * 1024, forbidden: THREE }, // gemessen 42,7 KB (43745 B, Schritt 6)
  {
    name: 'Seiten ohne Spiel',
    pages: /^(?!index\.html$)/,
    budget: 32 * 1024,
    forbidden: new RegExp(`${GAME_CODE.source}|${THREE.source}`),
  },
];

const pagesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pagesIn(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );

const read = (path: string) => {
  try {
    return readFileSync(join(DIST, path), 'utf8');
  } catch {
    return null;
  }
};

const pages = pagesIn(DIST);
const usage: Usage[] = [];
const problems = pages.flatMap((file) => check(relative(DIST, file), readFileSync(file, 'utf8'), read, RULES, usage));
const kib = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const budgetOf = (name: string) => RULES.find((r) => r.name === name)?.budget ?? 0;
for (const u of usage.filter((x) => x.page === 'index.html'))
  console.log(`  ${u.rule}: ${u.file ?? u.page} ${kib(u.bytes)} von ${kib(budgetOf(u.rule))}`);
if (problems.length) {
  console.error(`Bundle-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ Bundle-Gate: ${pages.length} Seiten geprüft, Spiel unter dem Budget, keine andere Seite mit Spielcode`);
