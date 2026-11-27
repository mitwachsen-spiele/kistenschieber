# kistenschieber

Ein künftiges Spiel von [mitwachsen-spiele.de](https://www.mitwachsen-spiele.de/) für Kinder ab 3 Jahren, unter https://kistenschieber.mitwachsen-spiele.de/. Noch gibt es dort nur einen Platzhalter („Hier kommt bald was“), aber schon alles drumherum: Pipeline mit allen Guard-Gates, Deploy auf GitHub Pages, Renovate, Ruleset. Das Spiel kann also direkt hier entstehen, ohne dass noch etwas einzurichten ist.

Gebaut mit [Astro](https://astro.build), ausgeliefert als statische Seite. Vorbild für Spielcode, Gates und App ist [mitwachsen-spiele/weltenbummler](https://github.com/mitwachsen-spiele/weltenbummler).

## Schnellstart

```bash
npm install
npm run dev      # http://localhost:4321
```

| Befehl | Wirkung |
| --- | --- |
| `npm run check` | Typen. Guard-Gate |
| `npm test` | Unit-Tests (Vitest) mit Mindest-Abdeckung. Guard-Gate |
| `npm run lint` / `format:check` / `arch` | ESLint, Prettier, Architekturregeln. Guard-Gates |
| `npm run build` | fertige Seite in `dist/` |
| `npm run verify` | gültiges HTML, keine toten Links, Bundle-Gate, Seiten-Gate (keine externen Ressourcen). Guard-Gate |
| `npm run test:e2e` | Browser-Tests (Playwright) samt Barrierefreiheit nach WCAG 2.2 AA. Guard-Gate |
| `npm run gates:ci` | alle Gates CI-nah in Docker (2 CPUs), Pflicht vor jedem Push (`.githooks/pre-push`) |

## Pipeline und Deploy

`.github/workflows/deploy.yml`: `static`, `coverage`, `build` (mit `verify`), `e2e-site`; der Job `Guard-Gates` fasst sie zusammen und ist der einzige Pflicht-Check im Ruleset `protect main`. Nur auf `main` und nur nach `Guard-Gates` veröffentlicht `deploy` auf GitHub Pages. Für den Notfall `fast-deploy.yml` von Hand.

Einrichtung (Stand in larmic/mitwachsen-spiele#71): Pages mit Quelle „GitHub Actions“ und Custom domain `kistenschieber.mitwachsen-spiele.de`, DNS bei OVH `kistenschieber` als `CNAME` auf `mitwachsen-spiele.github.io.`, Domain in der Organisation verifiziert, Renovate-App der Organisation mit [renovate-config](https://github.com/mitwachsen-spiele/renovate-config).

## Lizenz

Der Quellcode steht unter der MIT-Lizenz. Texte und Bilder sind davon ausgenommen. Details in [LICENSE](LICENSE).
