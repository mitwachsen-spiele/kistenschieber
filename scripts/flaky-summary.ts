// Nach den Browser-Tests in der Pipeline (Job e2e-merge in deploy.yml, JSON aus den zusammengeführten Blob-Berichten
// aller Browser-Jobs): wackelige Tests in die Zusammenfassung des Laufs ($GITHUB_STEP_SUMMARY) und als Warnung am Test.
// Kein Gate – scheitert nie, auch ohne Bericht (dann liefen die Browser-Tests nicht oder wurden abgebrochen).
// Lokal: node scripts/flaky-summary.ts nach CI=1 npx playwright test.
// Logik und Tests: scripts/flaky.ts, scripts/flaky.test.ts

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import type { JSONReport } from '@playwright/test/reporter';
import { failedCount, flakyTests, summary, warnings } from './flaky.ts';

const REPORT = 'test-results/report.json';
/** testDir aus playwright.config.ts: Die Pfade im Bericht sind relativ dazu */
const TEST_DIR = 'e2e';

if (!existsSync(REPORT)) {
  console.log(`::notice title=Wackelige Tests::Kein Bericht ${REPORT} – die Browser-Tests liefen nicht bis zum Ende`);
  process.exit(0);
}
const report = JSON.parse(readFileSync(REPORT, 'utf8')) as JSONReport;
const flaky = flakyTests(report);
for (const w of warnings(flaky, TEST_DIR)) console.log(w);
const md = summary(flaky, TEST_DIR, failedCount(report));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else console.log(md);
