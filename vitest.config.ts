// Unit-Tests für die reine Logik (Würfel-Grafik, Spielregeln, Seitendaten, Bundle- und Seiten-Gate). Kein DOM, kein Astro nötig.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    // Fristen wie im Weltenbummler: Sie fangen nur Hänger ab und sind kein Maß für Geschwindigkeit (Löser-Tests über
    // alle Lektionen laufen mit Abdeckung auf 2 CPUs). Wie viel der Löser arbeitet, prüfen die Tests selbst
    testTimeout: 60_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      // nur die reinen Module: lib (Spielregeln, Grafik, App), data (Seite, App, Spieldaten), die reinen Teile des
      // Browser-Codes und die Gates in scripts/. Web Component, Canvas, Menü und Anmeldung des Service Workers prüft der
      // Browser-Test (e2e/); browser-store.ts greift auf window zu und bleibt draußen wie im Weltenbummler
      include: [
        'src/lib/**/*.ts',
        'src/data/**/*.ts',
        'src/scripts/games/ks-save.ts',
        'src/scripts/games/ks-router.ts',
        'src/scripts/games/ks-input.ts',
        'src/scripts/games/ks-sound.ts',
        'src/scripts/games/wake-lock.ts',
        'src/scripts/games/pwa-update.ts',
        'src/scripts/games/pwa-moment.ts',
        'scripts/{bundles,dist,flaky,pwa}.ts',
      ],
      reporter: [['text', { skipFull: true }], 'text-summary'],
      // Knapp unter dem gemessenen Stand (höchstens 1 Punkt): Sinkt die Abdeckung, fällt das Gate. Steigt sie, die
      // Schwellen mitziehen. Gemessen 98,83/96,75/98,74/98,83 (Schritt 9)
      thresholds: {
        statements: 98,
        branches: 96,
        functions: 98,
        lines: 98,
        // Die reinen Browser-Module enger (wie im Weltenbummler); gemessen 100/98,64/100/100 (Schritt 9)
        'src/scripts/**/*.ts': { statements: 95, branches: 86, functions: 95, lines: 95 },
      },
    },
  },
});
