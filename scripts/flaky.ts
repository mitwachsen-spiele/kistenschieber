// Wackelige Browser-Tests aus dem JSON-Bericht von Playwright (rein, ohne Dateisystem, damit testbar; das Einlesen und
// Schreiben macht flaky-summary.ts). Wackelig heißt: erst gescheitert, in der Wiederholung bestanden (Status `flaky`).
// Die Pipeline wird dann grün, der Test hat aber ein Problem (meist feste Wartezeiten auf dem langsamen Runner) –
// darum steht er in der Zusammenfassung des Laufs und als Warnung am Test, statt im Protokoll unterzugehen.
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';

export interface Flaky {
  /** Datei › describe › Test */
  title: string;
  /** Datei relativ zu `testDir` und Zeile des Tests */
  file: string;
  line: number;
  project: string;
  /** Versuche bis zum Bestehen (1 = eine Wiederholung) */
  retries: number;
  /** Erste Zeile des ersten Fehlers, ohne Farbcodes */
  error: string;
}

// eslint-disable-next-line no-control-regex -- Farbcodes (ANSI) aus den Fehlermeldungen von Playwright
const ANSI = /\u001b\[[0-9;]*m/g;
const lines = (s: string) => s.replace(ANSI, '').split('\n');
const firstLine = (s: string) => (lines(s).find((l) => l.trim()) ?? '').trim();

function collect(suite: JSONReportSuite, path: string[], out: Flaky[]) {
  const here = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs)
    for (const test of spec.tests) {
      if (test.status !== 'flaky') continue;
      const failed = test.results.find((r) => r.status !== 'passed' && r.status !== 'skipped');
      const message = failed?.error?.message ?? failed?.errors[0]?.message ?? '';
      out.push({
        title: [...here, spec.title].join(' › '),
        file: spec.file,
        line: spec.line,
        project: test.projectName,
        retries: Math.max(0, ...test.results.map((r) => r.retry)),
        error: firstLine(message) || 'ohne Fehlermeldung',
      });
    }
  for (const child of suite.suites ?? []) collect(child, here, out);
}

/** Zahl der Tests, die auch in der Wiederholung scheiterten (Status `unexpected`): Der Lauf ist dann rot */
export function failedCount(report: Pick<JSONReport, 'suites'>): number {
  const count = (suite: JSONReportSuite): number =>
    suite.specs.reduce((n, spec) => n + spec.tests.filter((t) => t.status === 'unexpected').length, 0) +
    (suite.suites ?? []).reduce((n, child) => n + count(child), 0);
  return report.suites.reduce((n, suite) => n + count(suite), 0);
}

/** Alle wackeligen Tests des Berichts, in der Reihenfolge des Berichts */
export function flakyTests(report: Pick<JSONReport, 'suites'>): Flaky[] {
  const out: Flaky[] = [];
  for (const suite of report.suites) collect(suite, [], out);
  return out;
}

// Werte in Workflow-Befehlen (::warning …::) maskieren, sonst brechen Zeilenumbrüche, Doppelpunkt und Komma sie auf
const escData = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = (s: string) => escData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

/** Eine Warnung je Test für GitHub Actions; `dir`: Ordner der Tests relativ zum Repo (testDir), damit sie am Test steht */
export function warnings(flaky: Flaky[], dir: string): string[] {
  return flaky.map((f) => {
    const project = f.project ? ` [${f.project}]` : '';
    const text = `${f.title}${project} bestand erst nach ${f.retries} Wiederholung(en): ${f.error}`;
    return `::warning file=${escProp(`${dir}/${f.file}`)},line=${f.line},title=${escProp('Wackeliger Test')}::${escData(text)}`;
  });
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * Zusammenfassung des Laufs als Markdown ($GITHUB_STEP_SUMMARY). `failed`: Tests, die auch in der Wiederholung
 * scheiterten – die Zusammenfassung steht auch nach einem roten Lauf da und darf dann nicht nach Entwarnung klingen
 */
export function summary(flaky: Flaky[], dir: string, failed = 0): string {
  const red = failed
    ? [`**${failed} Test(s) rot**, auch in der Wiederholung – Fehler im Protokoll und im Bericht.`, '']
    : [];
  if (!flaky.length) {
    if (failed) return ['### Browser-Tests: rot', '', ...red, 'Keine wackeligen Tests.', ''].join('\n');
    return '### Browser-Tests\n\nKeine wackeligen Tests: alle bestanden im ersten Versuch.\n';
  }
  return [
    failed ? '### Browser-Tests: rot, dazu wackelige Tests' : '### Browser-Tests: wackelige Tests',
    '',
    ...red,
    `${flaky.length} Test(s) bestanden erst in der Wiederholung. Grün, aber zu reparieren (Ursache meist eine feste Wartezeit).`,
    '',
    '| Test | Ort | Wiederholungen | Erster Fehler |',
    '| --- | --- | --- | --- |',
    ...flaky.map(
      (f) => `| ${cell(f.title)} | \`${dir}/${f.file}:${f.line}\` | ${f.retries} | ${cell(f.error).slice(0, 200)} |`,
    ),
    '',
  ].join('\n');
}
