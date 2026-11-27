# CLAUDE.md

Künftiges Spiel „Kistenschieber“ von mitwachsen-spiele.de (Lars Michaelis), unter https://kistenschieber.mitwachsen-spiele.de/. Heute nur ein Platzhalter mit voller Pipeline. Astro 7, statische Ausgabe, Sprache Deutsch. Die Homepage liegt in `mitwachsen-spiele/website`, das erste Spiel in `mitwachsen-spiele/weltenbummler` (Vorbild für Spielcode, Gates, App und Service Worker, wenn das Spiel hier entsteht).

## Befehle

```bash
npm run dev      # Entwicklungsserver auf http://localhost:4321
npm run check    # Guard-Gate: Typen
npm test         # Guard-Gate: Unit-Tests (Vitest) mit Mindest-Abdeckung (vitest.config.ts)
npm run lint     # Guard-Gate: ESLint
npm run format   # Prettier; `npm run format:check` ist das Guard-Gate
npm run arch     # Guard-Gate: Architekturregeln (dependency-cruiser)
npm run build    # statische Seite nach dist/
npm run verify   # Guard-Gate nach dem Build: gültiges HTML, keine toten internen Links, Bundle-Gate, Seiten-Gate (keine externen Ressourcen)
npm run test:e2e # Guard-Gate nach dem Build: Browser-Tests (Playwright, e2e/) samt Barrierefreiheit nach WCAG 2.2 AA
npm run gates:ci # alle Gates CI-nah in Docker (scripts/ci-local.sh), 2 CPUs; grün schreibt den Tree-Hash nach .ci-local-ok
# Git-Hooks: .githooks/pre-commit (Formatierung, Lint, Architektur, Tests), .githooks/pre-push (verlangt grünes gates:ci)
```

## Aufbau

- `src/pages/` – Platzhalter `/`, 404, `og.png`, Favicons, `apple-touch-icon`
- `src/data/site.ts` – Seitendaten, Farben, Adressen von Homepage und Weltenbummler
- `src/lib/voxel/` – Würfel-Grafik, läuft beim Build
- `src/components/`, `src/layouts/`, `src/styles/` – Oberfläche und Design-Tokens
- `scripts/` – Gates nach dem Build (`bundles.ts`, `dist.ts`), `ci-local.sh`

## Regeln

- Design-Tokens aus `tokens.css` nutzen, keine neuen Farben ohne Grund. Gold ist die einzige Aktionsfarbe.
- Keine externen Ressourcen ohne Klick des Nutzers (Schriften lokal). Geprüft durch `npm run verify:dist`.
- Keine Logos, Figuren oder Texturen aus Minecraft oder Hytale – nur eigene Voxel-Grafik.
- Impressum (larmic.de) und Datenschutz (www.mitwachsen-spiele.de/datenschutz/) liegen außerhalb; speichert das Spiel später etwas im Browser, muss die Datenschutzerklärung im Repo `website` das nennen.
- Der Platzhalter ist `noindex`. Kommt das Spiel, bekommen Bundle-Gate (`scripts/verify-bundles.ts`) und Browser-Tests eigene Regeln, Vorbild ist `weltenbummler`.
- TypeScript prüft jeden Index-Zugriff (`noUncheckedIndexedAccess`): fehlende Einträge behandeln.
- Arbeitsweise mit Issues und Pull Requests: Was umgesetzt wird, steht als Issue im Repo (Entwürfe liegen im Artefakt, nicht im Repo). Jedes Feature und jeder Fehler bekommt einen eigenen Branch (`feat/<nr>-<kurz>`, `fix/<nr>-<kurz>`, nur Doku: `docs/<kurz>`); auf `main` wird nicht mehr direkt committet. Auf dem Branch entsteht das Feature in einzelnen Commits je Schritt wie bisher. Ist es fertig, wird der Branch gepusht und ein Pull Request mit `Closes #<nr>` in der Beschreibung angelegt. Das Gate bleibt der lokale CI-nahe Lauf (`npm run gates:ci`) vor dem Push, wie unten beschrieben; die Pipeline des Pull Requests ist die zweite Prüfung, sie ersetzt den lokalen Lauf nicht. Sind alle Gates der Pipeline grün, mergt Claude den Pull Request selbst (Merge-Commit, Branch danach löschen); erst das löst den Deploy aus. Ist ein Gate rot, wird nicht gemergt, sondern die Ursache auf dem Branch behoben. Aufgaben im Issue werden beim Erledigen abgehakt.
- CI-naher Lauf (`npm run gates:ci`): Bevor dem Nutzer ein Feature als fertig gemeldet wird und vor jedem Push eines Stapels muss er auf dem finalen HEAD grün sein, auch nach Merges (der Pre-Push-Hook prüft `.ci-local-ok`). Lokale Läufe auf vielen Kernen sagen nichts über den 4-vCPU-Runner mit Software-WebGL. Ein roter oder wackliger Lauf wird nie wegerklärt („Flake“, „lokal grün“), sondern die Ursache behoben. Zeitgrenzen (`expect`, Test, Job) nur mit Trace und Begründung in der Commit-Nachricht anheben.
