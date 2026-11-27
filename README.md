# Kistenschieber

Ein ruhiges Denkspiel von [mitwachsen-spiele.de](https://www.mitwachsen-spiele.de/): Frauke schiebt Kisten an einem Hafenkai auf die gelben Felder. Ohne Uhr, ohne Leben, ohne Werbung, kostenlos im Browser und als App auf Handy und Tablet, auch ohne Internet. Unter https://kistenschieber.mitwachsen-spiele.de/.

Spielbar ist die Einführung mit 15 Lektionen, die Schritt für Schritt zeigen, wie Kisten sich schieben lassen und wo sie festsitzen, und danach die ersten sechs Level aus Kapitel 1 „Am Kai“ als Adventskalender: Level N geht am N. Dezember 2026 um 0 Uhr deutscher Zeit auf. Dazu kommen Startbildschirm, Levelwahl und Einstellungen. Die Level 7 bis 24 (mit Schranke, Schalter, Bodenluke und Tor) folgen.

Gebaut mit [Astro](https://astro.build), ausgeliefert als statische Seite über GitHub Pages. Vorlage ist das Artefakt „Kistenschieber“ (Entwurf mit Menüführung, Grafik, Stil und Figur); Vorbild für Gates, App und Service Worker ist [mitwachsen-spiele/weltenbummler](https://github.com/mitwachsen-spiele/weltenbummler).

## So wird gespielt

- **Ziel:** alle Kisten auf die gelben Felder. Die Figur schiebt, sie zieht nie.
- **Bedienen:** Feld antippen, und die Figur läuft hin; eine Kiste antippen zeigt Pfeile, ein Pfeil schiebt sie. Auf Handy und Tablet gibt es dazu ein Steuerkreuz (Seite wählbar). Am Computer: Pfeiltasten oder WASD, Z zurück, R neu, H Tipp, M oder Esc Menü.
- **Hilfen:** „Zug zurück“ geht immer, auch nach einem Neustart. Eine Kiste, die kein Ziel mehr erreichen kann (Ecke oder Wand ohne Ziel), bekommt einen roten Rand. „Tipp“ (im Menü oder H) zeigt die nächste Kiste und mit einem Pfeil ihre Richtung, „Lösung zeigen“ spielt die Lektion vor. Nach drei Rückschlägen bietet das Spiel das Überspringen an.
- **Ton:** leise Töne beim Laufen und Schieben, ein Klick, wenn eine Kiste auf ihrem Ziel einrastet, eine kleine Melodie bei „Geschafft!“. In den Einstellungen abschaltbar („Ton: Aus“). Ohne Audiodateien, erst nach dem ersten Tippen oder Tastendruck.
- **Fortschritt:** Lektionen und Level werden der Reihe nach frei. Geschafft, übersprungen oder mit Lösung gesehen macht die nächste frei; ein Level dazu erst an seinem Tag. Die Levelwahl zeigt, was noch offen ist und wann ein Level aufgeht.

Die Regeln im Einzelnen und die Tests dazu stehen in der Spec [docs/specs/kistenschieber.md](docs/specs/kistenschieber.md).

## Schnellstart

Voraussetzung ist Node.js in der Version aus `.nvmrc`.

```bash
npm install
npm run dev      # http://localhost:4321
```

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Live-Reload |
| `npm run check` | Typen. Guard-Gate |
| `npm test` | Unit-Tests (Vitest) für Spielregeln, Löser, Lektionen, Grafik, Speichern, App und die Gates selbst, mit Mindest-Abdeckung der reinen Module (`vitest.config.ts`). Guard-Gate |
| `npm run lint` / `format:check` / `arch` | ESLint, Prettier, Architekturregeln (dependency-cruiser). Guard-Gates |
| `npm run build` | fertige Seite in `dist/` |
| `npm run verify` | gültiges HTML, keine toten Links und Sprungmarken, Bundle-Gate (Kern der Spielseite und Nachgeladenes im Budget, übrige Seiten ohne Spiel), Seiten-Gate (keine externen Ressourcen), App-Gate (Manifest, Icons, Service Worker, vorab Gespeichertes im Budget). Guard-Gate |
| `npm run test:e2e` | Browser-Tests (Playwright, `e2e/`): Bildschirme, Spielen mit Tasten und Touch, Menü, Tipp und Lösung, App ohne Netz und Updates mit zwei Fassungen, Barrierefreiheit nach WCAG 2.2 AA. Guard-Gate; einmalig `npx playwright install chromium` |
| `npm run gates` | alle Gates in der Reihenfolge der Pipeline |
| `npm run gates:ci` | alle Gates CI-nah in Docker (2 CPUs), Pflicht vor jedem Push (`.githooks/pre-push`) |

## Projektstruktur

```
src/
  pages/              / (das Spiel, noindex), 404; Manifest, Icons, Favicon und og.png (beim Build erzeugt)
  components/         KistenschieberGame (alle Bildschirme als HTML), Teile der 404-Seite
  layouts/            BaseLayout (Kopfdaten, Schriften), PlainPage (404)
  lib/games/sokoban/  Regeln, Löser, Spielzustand, Fortschritt, Szene, Konfetti (rein, getestet)
  lib/games/oblique/  schräge Kamera, Formen, Modelle, feine Texturen, SVG-Zeichner (rein, getestet)
  lib/pwa/            Manifest, Liste für den Service Worker, Service Worker (rein, getestet)
  lib/voxel/          Würfel-Grafik und Symbol beim Build
  data/games/         die 15 Lektionen, die Level mit ihrem Tag, Texte, Stil „An der Kaje“, Kapitel und Ausblick
  data/               Seitendaten, App, Symbol
  scripts/games/      das Spiel im Browser: Web Component, Bildschirme, Spielfeld, Eingabe, Speichern,
                      Zeichnen, Ton, Wake Lock, Anmeldung des Service Workers
  integrations/       schreibt nach dem Build den Service Worker (dist/sw.js)
  styles/             tokens.css (Design-Tokens), game.css, global.css, sections.css
scripts/              Gates nach dem Build (Bundle-, Seiten-, App-Gate), gates:ci, Auswertung wackeliger Tests
e2e/                  Browser-Tests und Barrierefreiheit (Playwright)
docs/specs/           Spec des Spiels (Regeln, Invarianten, zugehörige Tests)
docs/design-system.md Farben, Typografie, Grafik, Figur, Symbol
```

## Als App installieren

Auf dem Android-Handy oder -Tablet im Browsermenü „App installieren“ wählen. Auf iPhone und iPad in Safari über „Teilen“ den Eintrag „Zum Home-Bildschirm“. Danach startet Kistenschieber ohne Browserleisten wie eine App und läuft auch ohne Internet, nachdem es einmal mit Internet geöffnet war. Es dreht sich mit dem Gerät, hoch und quer, und der Bildschirm bleibt beim Spielen an.

Neue Versionen lädt die App still im Hintergrund und übernimmt sie nur in ruhigen Momenten: auf dem Startbildschirm, in der Levelwahl, in den Einstellungen oder nach „Geschafft!“, nie mitten in einer Lektion oder einem Level.

## Pipeline und Deploy

`.github/workflows/deploy.yml` läuft bei jedem Pull Request und jedem Push auf `main`: `static` (Format, Lint, Architektur, Typen), `coverage` (Unit-Tests), `build` (mit `verify`), dann auf genau diesem Build `e2e-site` und `e2e-game` mit Blob-Berichten; `e2e-merge` fasst sie zu einem Bericht zusammen (kein Gate). Der Job `Guard-Gates` fasst die Gates zusammen und ist der einzige Pflicht-Check im Ruleset `protect main`. Nur auf `main` und nur nach `Guard-Gates` veröffentlicht `deploy` auf GitHub Pages. Für den Notfall `fast-deploy.yml` von Hand.

Einrichtung (Stand in larmic/mitwachsen-spiele#71): Pages mit Quelle „GitHub Actions“ und Custom domain `kistenschieber.mitwachsen-spiele.de`, DNS bei OVH `kistenschieber` als `CNAME` auf `mitwachsen-spiele.github.io.`, Domain in der Organisation verifiziert, Renovate-App der Organisation mit [renovate-config](https://github.com/mitwachsen-spiele/renovate-config).

## Datenschutz

- Beim Laden wird nichts von Dritten nachgeladen: Schriften sind lokal gebündelt, keine Cookies, kein Tracking.
- Einstellungen und Fortschritt bleiben im Browser (`localStorage`, Schlüssel mit dem Präfix `kistenschieber.`) und werden nicht übertragen. Der Service Worker speichert nur die Dateien des Spiels (Caches `kistenschieber-*`), damit es ohne Netz startet.
- Impressum auf larmic.de, Datenschutzerklärung auf https://www.mitwachsen-spiele.de/datenschutz/ (Repo `website`); was das Spiel speichert, muss dort stehen.

## Design

Farben, Typografie, Grafik und Figur stehen in [docs/design-system.md](docs/design-system.md), die Design-Tokens in `src/styles/tokens.css`.

## Lizenz

Der Quellcode steht unter der MIT-Lizenz. Texte und Bilder sind davon ausgenommen. Details in [LICENSE](LICENSE).
