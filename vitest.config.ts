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
      // nur die reinen Module; Spielregeln (lib/games) und Spieldaten (data/games) gehören dazu
      include: ['src/lib/**/*.ts', 'src/data/site.ts', 'src/data/games/**/*.ts', 'scripts/{bundles,dist}.ts'],
      reporter: [['text', { skipFull: true }], 'text-summary'],
      // Knapp unter dem gemessenen Stand: Sinkt die Abdeckung, fällt das Gate. Steigt sie, die Schwellen mitziehen.
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
