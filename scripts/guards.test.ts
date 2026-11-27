// Die Grenzen der Gates selbst: Budgets mit Luft (gemessen + etwa 10 %), Abdeckung knapp unter dem Messwert, Fristen
// der Pipeline nach der 2,5×-Regel mit Untergrenze, Blob-Berichte für den gemeinsamen Bericht. Gelesen wird der Text der Dateien – die
// Gates selbst laufen erst nach dem Build (verify) und in der Pipeline.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** Budgets der Form `X * 1024 … // gemessen … (N B, …)`: Budget und Messwert in Bytes */
function budgets(src: string): { line: string; budget: number; measured: number }[] {
  return src
    .split('\n')
    .filter((l) => l.includes('// gemessen'))
    .map((line) => {
      const b = /(\d+(?:\.\d+)?) \* 1024/.exec(line);
      const m = /\((\d+) B\b/.exec(line);
      if (!b?.[1] || !m?.[1]) throw new Error(`Budget ohne Wert oder Messwert in Bytes: ${line}`);
      return { line: line.trim(), budget: Number(b[1]) * 1024, measured: Number(m[1]) };
    });
}

describe('Budgets: gemessen + etwa 10 %', () => {
  const all = [...budgets(read('scripts/verify-bundles.ts')), ...budgets(read('scripts/verify-pwa.ts'))];

  it('Spiel, Nachgeladen vom Kern und Vorab-Speicher stehen mit Messwert da', () => {
    expect(all).toHaveLength(3);
    expect(read('scripts/verify-pwa.ts')).toMatch(/const PRECACHE_BUDGET = [\d.]+ \* 1024; \/\/ gemessen/);
  });

  it.each(all)('Luft zwischen 8 und 12 Prozent: $line', (b) => {
    const headroom = b.budget / b.measured - 1;
    expect(headroom).toBeGreaterThanOrEqual(0.08);
    expect(headroom).toBeLessThanOrEqual(0.12);
  });

  it('Seiten ohne Spiel: fest 32 KB, nicht gemessen', () => {
    expect(read('scripts/verify-bundles.ts')).toMatch(/name: 'Seiten ohne Spiel',[\s\S]*?budget: 32 \* 1024,\n/);
  });
});

describe('Abdeckung: höchstens 1 Punkt unter dem Messwert', () => {
  const src = read('vitest.config.ts');

  it('globale Schwellen knapp unter dem gemessenen Stand', () => {
    const m = /Gemessen ([\d,]+)\/([\d,]+)\/([\d,]+)\/([\d,]+)/.exec(src);
    expect(m).not.toBeNull();
    const measured = m!.slice(1).map((v) => Number(v.replace(',', '.')));
    const t = /statements: (\d+),\s+branches: (\d+),\s+functions: (\d+),\s+lines: (\d+),/.exec(src);
    expect(t).not.toBeNull();
    const thresholds = t!.slice(1).map(Number);
    thresholds.forEach((v, i) => {
      expect(v).toBeLessThanOrEqual(measured[i]!);
      expect(v).toBeGreaterThanOrEqual(measured[i]! - 1);
    });
  });

  it('die reinen Browser-Module mit 95/86/95/95 wie im Weltenbummler', () => {
    expect(src).toContain("'src/scripts/**/*.ts': { statements: 95, branches: 86, functions: 95, lines: 95 }");
  });

  it('nur reine Module in der Abdeckung, auch flaky.ts', () => {
    const include = /include: \[([\s\S]*?)\]/.exec(src.slice(src.indexOf('coverage:')))?.[1] ?? '';
    expect(include).toContain("'scripts/{bundles,dist,flaky,pwa}.ts'");
    // Browser-Code mit DOM, Canvas oder Service Worker prüft der Browser-Test
    for (const dom of ['ks-kistenschieber', 'ks-game', 'ks-screens', 'ks-touch', 'ks-menu', 'pwa-register', 'render/'])
      expect(include).not.toContain(dom);
    expect(include).not.toMatch(/'src\/scripts\/\*\*/);
  });
});

/** Jobs aus deploy.yml: Name → Text des Jobs */
function jobs(yml: string): Map<string, string> {
  const body = yml.slice(yml.indexOf('\njobs:\n'));
  const out = new Map<string, string>();
  const re = /^ {2}([\w-]+):\n([\s\S]*?)(?=^ {2}[\w-]+:\n|(?![\s\S]))/gm;
  for (const m of body.matchAll(re)) out.set(m[1]!, m[2]!);
  return out;
}

describe('Pipeline (deploy.yml)', () => {
  const yml = read('.github/workflows/deploy.yml');
  const all = jobs(yml);
  const job = (name: string) => all.get(name) ?? '';
  const minutes = (name: string) => Number(/timeout-minutes: (\d+)/.exec(job(name))?.[1]);

  it('Guard-Gates wartet auf alle Gates, nicht auf den Bericht', () => {
    expect(job('guard-gates')).toContain('needs: [static, coverage, build, e2e-site, e2e-game]');
    expect(all.has('e2e-merge')).toBe(true);
    expect(job('guard-gates')).not.toContain('e2e-merge');
  });

  it('beide Browser-Jobs schreiben Blob-Berichte, e2e-merge führt sie zusammen', () => {
    for (const [name, part] of [
      ['e2e-site', 'site'],
      ['e2e-game', 'game'],
    ] as const) {
      expect(job(name)).toContain('--reporter=github,blob');
      expect(job(name)).toContain(`PLAYWRIGHT_BLOB_OUTPUT_NAME: report-${part}.zip`);
      expect(job(name)).toContain(`name: blob-report-${part}`);
    }
    const merge = job('e2e-merge');
    expect(merge).toContain('needs: [build, e2e-site, e2e-game]');
    expect(merge).toContain('pattern: blob-report-*');
    expect(merge).toContain('npx playwright merge-reports --reporter=html,json blob-report/');
    expect(merge).toContain('PLAYWRIGHT_JSON_OUTPUT_FILE: test-results/report.json');
    expect(merge).toContain('node scripts/flaky-summary.ts');
  });

  it('der JSON-Bericht liegt dort, wo flaky-summary.ts ihn liest', () => {
    expect(read('scripts/flaky-summary.ts')).toContain("const REPORT = 'test-results/report.json';");
    expect(read('playwright.config.ts')).toContain("['json', { outputFile: 'test-results/report.json' }]");
  });

  it('die alte Regel „großzügig“ ist ersetzt durch die 2,5×-Regel', () => {
    expect(yml).not.toContain('großzügig');
    expect(yml).toContain('etwa das 2,5-Fache der Dauer auf 2 CPUs (npm run gates:ci)');
  });

  it('jede Frist hat einen Kommentar', () => {
    for (const [name, text] of all) expect(text, name).toMatch(/timeout-minutes: \d+ # \S/);
  });

  // Einrichten und Untergrenzen wie im Kommentar über `jobs:`; gates:ci rechnet mit denselben Werten
  const sh = read('scripts/ci-local.sh');
  const setupPlain = Number(/^SETUP_PLAIN=(\d+)$/m.exec(sh)?.[1]);
  const setupBrowser = Number(/^SETUP_BROWSER=(\d+)$/m.exec(sh)?.[1]);

  it('das Einrichten ist auf GitHub gemessen und steht gleich in gates:ci', () => {
    expect(setupPlain).toBeGreaterThan(0);
    expect(setupBrowser).toBeGreaterThan(setupPlain);
    expect(yml).toContain(`ohne Browser ${setupPlain} s`);
    expect(yml).toContain(`mit Browser ${setupBrowser} s`);
    expect(yml).toContain('mindestens 3 min, Browser-Jobs 5 min');
  });

  it.each([
    ['static', 'plain', 3],
    ['coverage', 'plain', 3],
    ['build', 'plain', 3],
    ['e2e-site', 'browser', 5],
    ['e2e-game', 'browser', 5],
  ] as const)('Frist von %s: mindestens 2,5 × (gemessen + Einrichten) und die Untergrenze', (name, kind, floor) => {
    const s = Number(/timeout-minutes: \d+ # gemessen (?:etwa )?(\d+) s/.exec(job(name))?.[1]);
    expect(s).toBeGreaterThan(0);
    const rule = Math.ceil((2.5 * (s + (kind === 'plain' ? setupPlain : setupBrowser))) / 60);
    expect(job(name)).toContain(`Regel ${rule} min, Untergrenze ${floor}`);
    expect(minutes(name)).toBeGreaterThanOrEqual(Math.max(rule, floor));
    // anheben mit Begründung geht, aber die alten großzügigen Fristen kommen nicht unbemerkt zurück
    expect(minutes(name)).toBeLessThanOrEqual(Math.max(floor, 2 * rule));
  });

  it('e2e-merge hat die Frist des Weltenbummlers', () => {
    expect(minutes('e2e-merge')).toBe(4);
  });

  it('gates:ci misst die Browser-Tests je Job und prüft jede Frist mit demselben Einrichten', () => {
    expect(sh).toContain('step e2e-site e2e --project=site');
    expect(sh).toContain('step e2e-game e2e --project=game --project=pwa-update');
    expect(job('e2e-site')).toContain('npx playwright test --project=site ');
    expect(job('e2e-game')).toContain('npx playwright test --project=game --project=pwa-update ');
    for (const line of [
      'check_job static "$SETUP_PLAIN" format:check lint arch check',
      'check_job coverage "$SETUP_PLAIN" test',
      'check_job build "$SETUP_PLAIN" build verify',
      'check_job e2e-site "$SETUP_BROWSER" e2e-site',
      'check_job e2e-game "$SETUP_BROWSER" e2e-game',
    ])
      expect(sh).toContain(line);
    expect(sh).toContain('[ $((5 * (t + setup))) -gt $((minutes * 120)) ]');
  });
});

describe('ESLint: keine Ausnahmen je Datei für die Größe', () => {
  it('max-lines und max-lines-per-function nur einmal gesetzt, für Tests nur ausgeschaltet', () => {
    const src = read('eslint.config.js');
    expect(src.match(/'max-lines': \['error'/g)).toHaveLength(1);
    expect(src.match(/'max-lines-per-function': \['error'/g)).toHaveLength(1);
    expect(src).not.toMatch(/files: \['src\//);
  });
});
