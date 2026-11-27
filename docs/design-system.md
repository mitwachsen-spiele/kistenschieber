# Designsystem

Kistenschieber hat einen Stil: „An der Kaje“, ein Hafenkai in feiner Grafik, und eine Figur: Frauke, die Stauerin. Vorlage ist das Artefakt „Kistenschieber“ (Seiten Grafik, Stil und Figur, Kisten und Ziele, Handy und Tablet). Gold ist die einzige Farbe für Aktionen. Alle Werte der Oberfläche stehen als CSS-Variablen in `src/styles/tokens.css`, die Farben des Spielfelds in `src/data/games/kaje.ts` und in den Textur-Zeichnern `src/lib/games/oblique/textures.ts`.

Alle Grafiken sind eigene Zeichnungen, ohne Logos, Figuren oder Texturen aus Minecraft oder Hytale.

## Farben der Oberfläche

Die Werte der Spielseite wechseln mit dem Farbschema (`prefers-color-scheme: dark`, oder `data-theme` an `<html>`). Beide Selektoren stehen in `tokens.css`: `:root:not([data-theme='light'])` in der Media-Query und `:root[data-theme='dark']`.

| Rolle | Token | Hell | Dunkel | Einsatz |
| --- | --- | --- | --- | --- |
| Himmel | `--sky` | #8dd0ee | #13213a | Hintergrund der Spielseite |
| Szene | `--sky-deep` → `--sky-low` | #79c7ea → #a6dbf2 | #0f1a2e → #1a2b48 | Verlauf hinter Spielfeld, Startbild und Vorschauen |
| Text | `--text` | #1d2838 | #eef1f6 | Fließtext und Überschriften auf dem Himmel und auf Flächen |
| Fläche | `--card` | #fffdf7 | #1d2533 | Lektionskarten, Einstellungen |
| Unterzeile | `--soft` | #4b5563 | #a9b4c4 | Notizen auf `--card`, `--wood`, `--slot` |
| Rahmen | `--line`, `--ks-px` | #1d2838 | #0a0f18 | Pixel-Rahmen im Spiel |
| Holz | `--wood` | #f3ead6 | #1d2533 | Hinweiskasten, Menü im Spiel |
| Fach | `--slot`, `--frame` | #e2d5ba, #b3a385 | #252f40, #46536a | Regler, Pillen, Teil „Level“ auf dem Start |
| Gold | `--gold`, `--gold-light`, `--gold-dark`, `--gold-edge`, `--on-gold` | #f0a531, #ffd47e, #b46a0c, #b46a0c, #1d2838 | Kante #ffc061 | Einzige Aktionsfarbe: großer Knopf, gedrückte Knöpfe, Fokusring, die Lektion, die dran ist |
| Geschafft | `--ok` | #2b7a42 | #7fd08f | ✓ auf der Karte |
| Übersprungen | `--skip` | #a65f08 | #ffc061 | ↷ auf der Karte |
| Gesehen | `--info` | #2c5f8c | #8cc4f0 | „Mit Lösung gesehen“ |
| Hell in beiden | `--ok-soft`, `--ok-edge`, `--warn-soft` | #e3f5d6, #3c9656, #ffe2dc | gleich | Pille „✓ geschafft“, Schild bei Sieg und Warnung |
| Wasserblau | `--water-1`, `--water-2` | #8dd0ee, #3f8fc2 | gleich | `theme-color` und Hintergrund der App, Verlauf des App-Symbols (`src/data/pwa.ts`, ein Test hält es gleich mit `tokens.css`) |
| Kiste | `--crate`, `--crate-dark` | #c58b4d, #6e4526 | gleich | Kistensymbol der Oberfläche |

Knöpfe, Schild, Zähler und Steuerkreuz bleiben auch dunkel hell (`--paper` #fffdf7 mit `--ink` #1d2838). Die Grundfarben `--ink`, `--paper`, `--muted`, `--sky-1/2/3`, Erde und Stein gelten unverändert für die 404-Seite (`PlainPage.astro`).

Die Browserleiste ist hell `#8dd0ee` und dunkel `#13213a` (`THEME_LIGHT`, `THEME_DARK` in `src/data/site.ts`).

## Typografie

| Schrift | Schnitte | Einsatz |
| --- | --- | --- |
| Pixelify Sans | 500, 700 | Titel „Kistenschieber“, Überschriften, Knöpfe, Zähler |
| Nunito | 400, 700, 800 | Fließtext, Schild, Karten |

Beide Schriften sind über `@fontsource` lokal gebündelt, nur die `latin`-Schnitte.

## Bausteine

- **Pixel-Rahmen:** vier Box-Schatten statt `border` (`--ks-px`, 3 px), dadurch fehlen die Eckpixel.
- **Knopf (`.btn`):** helle Fläche, Pixel-Rahmen, sinkt beim Drücken 2 px ein. `.btn.big` für die großen Knöpfe, `.btn.primary` in Gold mit hellem Kantenlicht oben und dunklem unten. Gedrückte Umschalter (`aria-pressed="true"`) sind golden. Alle Knöpfe auf Handy und Tablet mindestens 48 px hoch.
- **Fokus:** 3 px Gold, 2 px Abstand, auch auf der Spielfläche.
- **Schild (`.sign`):** helle Fläche, nur mit Meldung (leer unsichtbar, nimmt keinen Platz), `aria-live`; hochkant im Himmel direkt über der Insel, quer in der Spalte neben dem Feld, nie auf der Insel; bei einer Warnung `--warn-soft`, beim Sieg `--ok-soft`.
- **Karte (`.card.lv`):** Vorschau der Lektion, Titel, Unterzeile, Status-Zeile mit ✓ oder ↷. Hebt sich beim Überfahren um 3 px (nicht bei reduzierter Bewegung). Gesperrt mit Deckkraft 0,62 und grauer Vorschau. Die Lektion, die dran ist, mit goldenem Rahmen innen und außen.
- **Pille (`.pill`):** kleine Marke neben Überschriften, `.pill.on` grün für „✓ geschafft“.
- **Teile des Starts (`.part`):** „Einführung“ (`.part.now`) als Fläche `--card` mit Pixel-Rahmen und dem einzigen goldenen Knopf; „Level“ (`.part.soon`) vertieft auf `--slot` mit gestricheltem Rand in `--frame`, Text ganz in `--soft`, dunkel auf `--sky-deep` (tiefer als die Einführung), ohne Gold, ohne Hover, nichts zum Anklicken; dieselbe Karte unten in der Levelwahl. Pille „jetzt spielbar“ (`.pill.now`) hell mit dunklem Rand, „kommen bald“ gedämpft, beide 14 px. Breit nebeneinander, hochkant untereinander, Handy quer rechts neben Titel, Startbild und Nebenknöpfen. Die Nebenknöpfe des Starts sind dunkel auf `--card`.
- **Hinweiskasten (`.advice`), Menü (`dialog.menu`):** Holzfläche, das Menü höchstens 380 px bzw. 92 % breit.
- **Steuerkreuz (`.pad`):** vier Knöpfe 58 px (schmal 54, niedrig 48), beim Drücken golden; die Pfeile drehen sich mit der Kamera.

## Grafik „fein“

Das Spielfeld wird im Browser auf eine Canvas gezeichnet (`src/scripts/games/render/`), aus reinen Bausteinen in `src/lib/games/`.

- **Kamera** (`src/lib/games/oblique/camera.ts`): schräg von oben, Drehung 0–45° (Standard 20°) und Neigung 20–80° (Standard 50°). Ein Feld ist 40·√2 px breit; bei Neigung 30° stimmen die Maße mit der Würfel-Grafik des Weltenbummlers überein (Blockhöhe 44,8).
- **Blöcke:** drei Flächen je Block, oben +6 % Weiß, vorn −10 %, rechts −28 % Schwarz. Texturen 128 × 128 (auf 64er-Koordinaten gezeichnet), Blöcke mit Auflösung 4, weich skaliert.
- **Maße** (`src/data/games/kaje.ts`): Mauer halbhoch (0,5), Kiste 0,8 breit und mittig, Wasser 0,3 unter dem Boden als Rand eine Zelle rundum (fällt unter 560 px Feldbreite weg).
- **Tiefe:** gezeichnet wird von hinten nach vorn nach `(x·sin + y·cos)·√2 + z·0,3`.

### Texturen

Jede Textur ist deterministisch (Zufall `mulberry32` mit festem Seed) und zeichnet gegen die schmale Schnittstelle `Pen`: im Browser der Canvas-Kontext, beim Build `svgPen` für das App-Symbol.

| Textur | Seed | Farben | Wo |
| --- | --- | --- | --- |
| Klinker | 11 | Steine #a9583c, #9e5035, #b4633f, #94492f, #a45a40, #ae5e43 auf Fuge #6a3a28, 8 Reihen im Läuferverband | Boden oben |
| Granit | 23 | Quader #a1a9b2, #959da7, #a7aeb6, #9aa2ac auf #59606a, 3 Reihen, 420 Sprenkel | Seiten von Boden und Mauer |
| Kaimauer | 37 | Platte #b2b9c1 mit Fase | Mauer oben |
| Wasser | 41 | Verlauf #53a3d6 → #3a86bb, 11 Wellen | Rand oben |
| Wasser-Seite | 43 | Verlauf #2f74a3 → #1f5378, 6 Glanzstriche | Rand seitlich |
| Kiste | 53 | Rahmen #24527f, Licht #4580b8, Schatten #183b5c, vier Bretter #e4bf88/#d7ae74, Nieten #d5dde4; Seiten mit Querstrebe #cfa266 | Kiste |
| Kiste auf dem Ziel | 59 | Rahmen #2b7a42, Licht #4ea267, Schatten #1e5a30; Deckel mit Haken #fff6d2 | Kiste auf einem Ziel |

### Kisten und Ziele

Jeder Zustand hat eine eigene Form, nicht nur eine Farbe (Haken für Menschen mit Rot-Grün-Schwäche). Kisten werfen Schatten, Ziele nicht.

| Zustand | Aussehen |
| --- | --- |
| Ziel | flach: Quadrat 0,38 Tinte, darauf 0,31 Gelb #ffd23f, Kern 0,15 Tinte |
| Kiste | Holz mit blauem Rahmen, Schatten in drei Lagen |
| Kiste auf dem Ziel | grüner Rahmen, Haken auf dem Deckel; wird erst nach dem Schieben grün |
| Angetippt | goldener Rand #f0a531, goldene Pfeile auf den Feldern dahinter |
| Tipp | türkiser Rand und nur ein Pfeil #2ec4b6, 1,5-mal so groß mit hellem Saum (keine weiteren Richtungen) |
| Pfeil in eine Sackgasse | grau #a3aab3 |
| Festsitzend | roter Rand #e0442f |

Weitere feine Dinge: weicher Schatten am Boden vor Mauern, helle Oberkante auf Mauer und Kiste, runder Schatten unter der Figur. Konfetti beim Sieg in #ffd23f, #3c9656, #ffffff, #f0a531.

### Frauke

Die eine Figur des Spiels, aus Quadern (`humanoid` in `src/lib/games/oblique/models.ts`, Aussehen `FRAUKE` in `kaje.ts`): „Rote Wollmütze mit Bommel, Zopf, grüne Weste mit Taschen über hellblauem Hemd, feste Stiefel.“

| Teil | Farbe |
| --- | --- |
| Haut, Schatten | #f1c6a3, #dea582 |
| Mütze, Bommel | #b8352d / #d6453b, #f3eee4 |
| Zopf | #b0582a |
| Weste, Taschen | #3e6e4c, #2f5a3c |
| Hemd und Ärmel | #8db4d6 |
| Hose, Stiefel | #3b4150, #6e4527 |
| Augen, Mund, Wangen | #1d2233, #a0473a, #ea9a8c |

Posen: stehen, gehen (Arme und Beine schwingen gegenläufig), schieben (lehnt vor, Arme waagerecht, 0,22 vor ihrem Feld). Gegen Wand oder blockierte Kiste ein kurzer Ruck (0,1). In Ruhe schaut sie zur Kamera.

### Schmuck

Poller (#2e3440, #3a414e, #4a5262) auf Ecken und Mitten der Kaimauer, eine Möwe auf dem Poller oben rechts. Nur Bild, ohne Einfluss auf das Spiel.

## Bewegung

Laufen 120 ms, Schieben 170 ms, Ruck 160 ms, „Lösung zeigen“ 1,3-mal langsamer. Bei `prefers-reduced-motion` dauert jede Animation 1 ms, es gibt kein Konfetti, die Karten heben sich nicht, das Steuerkreuz dreht ohne Übergang.

## Symbol

Seiten- und App-Symbol ist die Kiste des Kais im Standard-Blickwinkel (20°/50°) auf einem Verlauf von `--water-1` nach `--water-2`, ohne Text (`src/data/app-icon.ts`, `src/lib/voxel/icon.ts`, beim Build gerendert): abgerundetes Quadrat mit Radius 22 %, Kiste 62 % breit, mittig und 2 % tiefer. Die maskierbare Fassung (`icon-maskable-512.png`) ist vollflächig ohne Rundung, die Kiste 48 % breit, damit ihr Rahmen im sicheren Kreis von 80 % bleibt. Dazu `favicon.svg`/`.ico`, `apple-touch-icon.png` (eckig, iOS rundet) und das Vorschaubild `og.png` (1200 × 630). Werte in `ICON_LOOK` (`src/data/pwa.ts`).

## Würfel-Grafik der 404-Seite

Die 404-Seite nutzt die Würfel-Grafik aus `src/lib/voxel/` (dimetrisch 2:1, Texturen 8 × 8 als Textraster in `textures.ts`, Symbole aus `blocks.ts`) mit Himmel, Erde und Stein wie auf mitwachsen-spiele.de.
