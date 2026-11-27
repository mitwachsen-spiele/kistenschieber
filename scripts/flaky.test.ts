import { describe, expect, it } from 'vitest';
import type { JSONReport, JSONReportSuite, JSONReportTestResult } from '@playwright/test/reporter';
import { failedCount, flakyTests, summary, warnings } from './flaky';

// Nur die Felder, die flaky.ts liest; der Rest des Berichts ist hier egal
const result = (status: JSONReportTestResult['status'], retry: number, message?: string) =>
  ({ status, retry, error: message ? { message } : undefined, errors: [] }) as unknown as JSONReportTestResult;
const spec = (title: string, line: number, status: string, results: JSONReportTestResult[]) => ({
  title,
  file: 'game.spec.ts',
  line,
  tests: [{ projectName: 'game', status, results }],
});
const report = (suites: unknown[]) => ({ suites: suites as JSONReportSuite[] }) as Pick<JSONReport, 'suites'>;

describe('Wackelige Tests', () => {
  const rep = report([
    {
      title: 'game.spec.ts',
      specs: [
        spec('startet', 3, 'expected', [result('passed', 0)]),
        spec('läuft', 9, 'flaky', [
          result('timedOut', 0, '\u001b[31mError: Timeout 5000ms exceeded.\u001b[39m\n\n  at game.spec.ts:12'),
          result('passed', 1),
        ]),
      ],
      suites: [
        {
          title: 'Wetter',
          specs: [
            spec('regnet', 20, 'unexpected', [result('failed', 0, 'x'), result('failed', 1, 'x')]),
            spec('schneit', 30, 'flaky', [result('failed', 0), result('passed', 1)]),
          ],
        },
      ],
    },
  ]);

  it('findet nur Tests, die erst in der Wiederholung bestanden, auch in describe-Blöcken', () => {
    expect(flakyTests(rep)).toEqual([
      {
        title: 'game.spec.ts › läuft',
        file: 'game.spec.ts',
        line: 9,
        project: 'game',
        retries: 1,
        error: 'Error: Timeout 5000ms exceeded.',
      },
      {
        title: 'game.spec.ts › Wetter › schneit',
        file: 'game.spec.ts',
        line: 30,
        project: 'game',
        retries: 1,
        error: 'ohne Fehlermeldung',
      },
    ]);
  });

  it('meldet je Test eine Warnung am Test, Sonderzeichen maskiert', () => {
    const [w] = warnings([{ ...flakyTests(rep)[0]!, error: 'a: b, 100%\nc' }], 'e2e');
    expect(w).toBe(
      '::warning file=e2e/game.spec.ts,line=9,title=Wackeliger Test::' +
        'game.spec.ts › läuft [game] bestand erst nach 1 Wiederholung(en): a: b, 100%25%0Ac',
    );
    expect(warnings([], 'e2e')).toEqual([]);
  });

  it('schreibt eine Tabelle in die Zusammenfassung, ohne wackelige Tests eine Entwarnung', () => {
    const md = summary([{ ...flakyTests(rep)[0]!, error: 'a | b' }], 'e2e');
    expect(md).toContain('1 Test(s) bestanden erst in der Wiederholung');
    expect(md).toContain('| game.spec.ts › läuft | `e2e/game.spec.ts:9` | 1 | a \\| b |');
    expect(summary([], 'e2e')).toContain('alle bestanden im ersten Versuch');
  });

  it('zählt rote Tests (auch in der Wiederholung gescheitert) und meldet nach rotem Lauf keine Entwarnung', () => {
    expect(failedCount(rep)).toBe(1);
    expect(failedCount(report([{ title: 'leer.spec.ts', specs: [] }]))).toBe(0);
    const red = summary([], 'e2e', 1);
    expect(red).toContain('1 Test(s) rot');
    expect(red).not.toContain('alle bestanden');
    const both = summary(flakyTests(rep), 'e2e', failedCount(rep));
    expect(both).toContain('1 Test(s) rot');
    expect(both).toContain('2 Test(s) bestanden erst in der Wiederholung');
  });
});
