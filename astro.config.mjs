// @ts-check
import { defineConfig } from 'astro/config';
import serviceWorker from './src/integrations/service-worker.ts';

// Nachgeladene Teile (pwa-register, ks-menu) behalten die Namen von Astro (_astro/<name>.<hash>.js): Daran erkennen
// sie das Bundle-Gate (scripts/verify-bundles.ts) und der Test der App-Updates (e2e/versions-dirs.ts)
export default defineConfig({
  site: 'https://kistenschieber.mitwachsen-spiele.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
  integrations: [
    // Service Worker des Spiels (dist/sw.js), nach dem Build aus der fertigen Seite erzeugt
    serviceWorker(),
  ],
});
