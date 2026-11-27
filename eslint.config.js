// Lint-Gate: empfohlene Regeln für JavaScript, TypeScript und Astro. Formatierung übernimmt Prettier.
// TypeScript-Dateien laufen mit Typinformation (typbewusste Regeln, z. B. nicht abgewartete Promises,
// überflüssige Casts). Dazu Grenzen für Größe und Verschachtelung.
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default defineConfig(
  { ignores: ['dist/', '.e2e/', '.astro/', 'node_modules/', 'test-results/', 'playwright-report/', 'coverage/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
  // Grenzen für Größe und Verschachtelung (Tests ausgenommen bei der Länge): Code bleibt klein und flach
  {
    files: ['**/*.ts'],
    rules: {
      complexity: ['error', 20],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ['**/*.test.ts', 'e2e/**'], rules: { 'max-lines': 'off', 'max-lines-per-function': 'off' } },
  // Browser-Tests warten auf einen Zustand, nie auf Uhrzeit oder eine Zahl von Bildern; das Spiel öffnen nur die Helfer
  // (e2e/helpers.ts: openGame wartet, bis es steht, mit Test-Uhr; render zeichnet ein Bild)
  {
    files: ['e2e/**'],
    ignores: ['e2e/helpers.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          property: 'waitForTimeout',
          message: 'Nicht auf Uhrzeit warten: auf einen Zustand warten oder die Test-Uhr nutzen (e2e/helpers.ts).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name=/^(waitFrames|frames)$/]',
          message: 'Nicht auf eine Zahl von Bildern warten: Bilder zeichnet `render` (e2e/helpers.ts).',
        },
        {
          selector: "CallExpression[callee.property.name='goto'][arguments.0.value=/^\\/(\\?|#|$)/]",
          message:
            'Das Spiel nur über e2e/helpers.ts öffnen: `openGame` (wartet, bis es steht), `gotoGame` nur fürs Laden.',
        },
      ],
    },
  },
  // Konfigurationsdateien laufen in Node
  { files: ['*.{js,mjs}'], languageOptions: { globals: { URL: 'readonly', process: 'readonly' } } },
  {
    files: ['*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { module: 'writable', require: 'readonly' } },
  },
);
