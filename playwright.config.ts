// Smoke-Test im Browser (Guard-Gate nach dem Build): Die fertige Seite aus dist/ wird ausgeliefert und in Chromium
// geöffnet. Prüft, was statische Gates nicht sehen: dass Seiten und Spiel laufen, ohne Fehler in der Konsole, barrierefrei.
// Einmalig lokal: npx playwright install chromium
import { defineConfig, devices } from '@playwright/test';

/** Specs der Seite: Startbildschirm, Einstellungen, Adressen, 404, installierbar (Projekt `site`) */
const SITE = /(site|installable)\.spec\.ts$/;
/** Specs, die im Spiel spielen oder es prüfen (Projekt `game`) */
const GAME = /(game|touch|a11y|pwa)\.spec\.ts$/;
/** Spec der App-Updates (Projekt `pwa-update`) */
const UPDATE = /pwa-update\.spec\.ts$/;

export default defineConfig({
  testDir: 'e2e',
  // Zweite Fassung der Seite für den Test der App-Updates, abgeleitet aus dist/ (e2e/versions.ts)
  globalSetup: './e2e/versions.ts',
  fullyParallel: true,
  // Höchstens 2 Worker, auch lokal: Der GitHub-Runner hat 4 vCPUs; Container melden alle Kerne des Wirts.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure' },
  // Jedes Projekt steht auch als --project=… in einem Browser-Job von .github/workflows/deploy.yml (geprüft von gates:ci)
  projects: [
    // Ohne Service Worker (wie im Weltenbummler): Die Tests prüfen Seite und Spiel, nicht den Speicher, und auf 2 Kernen
    // spart das je Test das Vorab-Speichern; Navigationen bleiben für page.route erreichbar. Fast jeder Test von `site`
    // öffnet das Spiel auf /. Nur e2e/pwa.spec.ts lässt ihn zu
    { name: 'site', testMatch: SITE, use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' } },
    { name: 'game', testMatch: GAME, use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' } },
    // App-Updates mit zwei Fassungen, teils zwei Tabs je Test: einzeln
    { name: 'pwa-update', testMatch: UPDATE, workers: 1, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: { command: 'node e2e/serve.ts', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
});
