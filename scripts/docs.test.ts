// Die Doku hält mit dem Code Schritt: Die Spec nennt jeden Schlüssel im localStorage, den Cache des Service Workers und
// den Wake Lock; jede Regel nennt einen Test, den es gibt; kein Verweis auf eine Datei, die fehlt; README und CLAUDE.md
// sprechen nicht mehr vom Platzhalter. Gelesen wird der Text der Dateien.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KEYS, PREFIX, SETTINGS_DEFAULT } from '../src/scripts/games/ks-save';
import { SERVICE_WORKER } from '../src/data/pwa';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const SPEC = 'docs/specs/kistenschieber.md';
const DOCS = ['README.md', 'CLAUDE.md', SPEC, 'docs/design-system.md'] as const;

/** Alle Dateien unter den Ordnern mit Code, Tests und Doku, als Pfade relativ zur Wurzel */
function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`;
    return e.isDirectory() ? files(path) : [path];
  });
}
const ALL = ['src', 'scripts', 'e2e', 'docs', '.github', '.githooks'].flatMap(files);
const byName = (name: string) => ALL.filter((f) => basename(f) === name);

/** Tabellen eines Markdown-Texts: Kopfzeile und Zeilen, je Zelle der Text */
function tables(md: string): { head: string[]; rows: string[][] }[] {
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split(' | ')
      .map((c) => c.trim());
  const out: { head: string[]; rows: string[][] }[] = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.startsWith('| ') || !/^\| ?-/.test(lines[i + 1] ?? '')) continue;
    const table = { head: cells(line), rows: [] as string[][] };
    for (i += 2; (lines[i] ?? '').startsWith('| '); i++) table.rows.push(cells(lines[i] ?? ''));
    out.push(table);
  }
  return out;
}

/** Namen von Testdateien in einer Zelle (in Backticks, mit oder ohne Ordner) */
const testFiles = (cell: string) => [...cell.matchAll(/`([\w./-]+\.(?:test|spec)\.ts)`/g)].map((m) => m[1] ?? '');

/** Zitierte Testtitel direkt vor einer Testdatei: „Titel“ in `datei` oder „Titel“ (`datei`), Titel auch mit „…“ darin */
const citedTitles = (md: string) =>
  [...md.matchAll(/„((?:[^„“]|„[^„“]*“)+)“\s+(?:in\s+|\()`([\w./-]+\.(?:test|spec)\.ts)`/g)].map((m) => ({
    title: m[1] ?? '',
    file: m[2] ?? '',
  }));

/** Gibt es die Testdatei? Mit Ordner genau dort, ohne Ordner genau einmal im Repo (sonst ist sie mehrdeutig) */
const testExists = (name: string) => (name.includes('/') ? existsSync(join(ROOT, name)) : byName(name).length === 1);

/** Was in einem Text wie ein Pfad im Repo aussieht: Ordner + Datei, oder ein Dateiname mit Endung des Codes */
function referencedPaths(md: string): string[] {
  const code = [...md.matchAll(/`([^`\s]+)`/g)].map((m) => m[1] ?? '');
  return code.filter(
    (t) =>
      !/[*<>{}…]|\.\.\.|^[a-z]+:\/\//.test(t) &&
      (/^(src|scripts|e2e|docs|\.github|\.githooks)\/[\w./[\]-]+$/.test(t) ||
        /^[\w.[\]-]+\.(ts|astro|css|cjs|mjs|sh)$/.test(t)),
  );
}

/** Gibt es den Pfad? Ein Name ohne Ordner darf auch irgendwo unter den Code-Ordnern liegen */
const pathExists = (p: string) => existsSync(join(ROOT, p)) || (!p.includes('/') && byName(p).length > 0);

/** Relative Links in Markdown (ohne Adressen und Sprungmarken), aufgelöst vom Ordner der Datei aus */
const links = (doc: string, md: string) =>
  [...md.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)]
    .map((m) => m[1] ?? '')
    .filter((l) => !/^[a-z]+:/.test(l))
    .map((l) => normalize(join(dirname(doc), l)));

describe('Spec: Speichern', () => {
  const spec = read(SPEC);

  it('nennt jeden Schlüssel im localStorage mit Präfix', () => {
    expect(Object.keys(SETTINGS_DEFAULT)).toEqual(['drehung', 'neigung', 'hand', 'ton']);
    expect(Object.keys(KEYS)).toEqual(['best', 'skip', 'shown', 'last']);
    const keys = [
      ...Object.keys(SETTINGS_DEFAULT),
      KEYS.best(1).replace(/1$/, 'N'),
      KEYS.skip(1).replace(/1$/, 'N'),
      KEYS.shown(1).replace(/1$/, 'N'),
      KEYS.last,
    ];
    expect(keys).toEqual(['drehung', 'neigung', 'hand', 'ton', 'best.eN', 'skip.eN', 'shown.eN', 'last']);
    expect(keys.map((k) => `${PREFIX}${k}`).filter((k) => !spec.includes(`\`${k}\``))).toEqual([]);
    expect(spec).toContain(`\`${PREFIX}probe\``);
  });

  it('nennt den Cache des Service Workers, dauerhaften Speicher und den Wake Lock', () => {
    expect(spec).toContain(`\`${SERVICE_WORKER.prefix}*\``);
    expect(spec).toContain('navigator.storage.persist()');
    expect(spec).toMatch(/Wake Lock/);
    expect(spec).toContain('`wake-lock.test.ts`');
  });
});

describe('Spec: jede Regel mit Test', () => {
  const spec = read(SPEC);
  const ruleTables = tables(spec).filter((t) => t.head[0] === 'Regel' && t.head[1] === 'Test');

  it('hat Tabellen „Regel | Test“ für Regeln, App und Updates', () => {
    expect(ruleTables.length).toBeGreaterThanOrEqual(3);
  });

  it('jede Zeile nennt mindestens eine Testdatei, die es gibt', () => {
    const missing = ruleTables.flatMap((t) =>
      t.rows.flatMap((row) => {
        const named = testFiles(row[1] ?? '');
        if (!named.length) return [`ohne Test: ${(row[0] ?? '').slice(0, 60)}`];
        return named.filter((n) => !testExists(n)).map((n) => `fehlt oder mehrdeutig: ${n}`);
      }),
    );
    expect(missing).toEqual([]);
  });

  it('auch die übrigen Testverweise (Teile, Invarianten) zeigen auf Dateien, die es gibt', () => {
    const missing = testFiles(spec).filter((n) => !testExists(n));
    expect(missing).toEqual([]);
  });

  it('zitierte Testtitel („…“ in `datei` oder „…“ (`datei`)) stehen in der genannten Datei', () => {
    const cited = citedTitles(spec);
    expect(cited.length).toBeGreaterThanOrEqual(5);
    const missing = cited.filter(({ title, file }) => {
      const path = file.includes('/') ? file : byName(file)[0];
      return !path || !read(path).includes(title);
    });
    expect(missing).toEqual([]);
  });

  it('erkennt einen zitierten Titel, den es nicht gibt (Gegenprobe)', () => {
    const cited = citedTitles('„gibt es nicht“ in `e2e/game.spec.ts`, „bis „Geschafft!““ (`e2e/game.spec.ts`)');
    expect(cited).toEqual([
      { title: 'gibt es nicht', file: 'e2e/game.spec.ts' },
      { title: 'bis „Geschafft!“', file: 'e2e/game.spec.ts' },
    ]);
    expect(read('e2e/game.spec.ts').includes('gibt es nicht')).toBe(false);
  });
});

describe('Doku: Verweise auf Dateien', () => {
  it.each(DOCS)('%s verweist nur auf Dateien, die es gibt', (doc) => {
    const md = read(doc);
    const missing = [...referencedPaths(md), ...links(doc, md)].filter((p) => !pathExists(p));
    expect(missing).toEqual([]);
  });

  it('erkennt einen Verweis ins Leere (Gegenprobe)', () => {
    const md = 'siehe `src/scripts/games/gibt-es-nicht.ts`, `fehlt.astro` und [x](../../src/fehlt.ts)';
    const found = [...referencedPaths(md), ...links(SPEC, md)].filter((p) => !pathExists(p));
    expect(found).toEqual(['src/scripts/games/gibt-es-nicht.ts', 'fehlt.astro', 'src/fehlt.ts']);
    expect(testExists('pwa.test.ts')).toBe(false); // zweimal im Repo: nur mit Ordner eindeutig
  });
});

describe('Doku: kein Platzhalter mehr', () => {
  it.each(['README.md', 'CLAUDE.md'])('%s spricht nicht vom Platzhalter', (doc) => {
    expect(read(doc)).not.toMatch(/Platzhalter|\bbald\b/i);
  });
});
