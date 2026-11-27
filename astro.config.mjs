// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kistenschieber.mitwachsen-spiele.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
});
