# Spec: Kistenschieber (Einführung)

Verhalten des Spiels unter `/` auf https://kistenschieber.mitwachsen-spiele.de/: Startbildschirm, Levelwahl, Einstellungen und die Einführung mit 15 Lektionen (Issue #6). Die 24 Level folgen in einem eigenen Issue; bis dahin zeigt die Levelwahl nur ihre zwei Kapitel als Ausblick. Die Seite für Eltern und die Datenschutzerklärung liegen auf www.mitwachsen-spiele.de (Repo `mitwachsen-spiele/website`).

Vorlage ist der Entwurf, das Artefakt „Kistenschieber“ mit den Seiten Startbildschirm, Level wählen, Einstellungen, Menüführung, Handy und Tablet, Grafik, Stil und Figur, Kisten und Ziele. Texte sind wörtlich daraus übernommen; Abweichungen stehen unten unter „Bewusst anders als im Entwurf“.

Umgesetzt ist es in reinen, getesteten Teilen und einer Web Component:

| Teil | Datei | Tests |
| --- | --- | --- |
| Level-Format (XSB), Nachbarn, Richtungen, Laufwege als LURD | [`src/lib/games/sokoban/level.ts`](../../src/lib/games/sokoban/level.ts) | `level.test.ts` |
| Löser: erreichbare Felder, kürzester Laufweg, Mindestschübe, A* über Schübe mit Grenzen | [`src/lib/games/sokoban/solver.ts`](../../src/lib/games/sokoban/solver.ts) | `solver.test.ts`, `lessons.test.ts` |
| Spielzustand einer Lektion (reiner Reducer): Schritte, Puffer, Zug zurück, Neustart, Sieg, Prüfung nach jedem Schub, Rückschläge, Tipp, Lösung zeigen | [`src/lib/games/sokoban/state.ts`](../../src/lib/games/sokoban/state.ts) | `state.test.ts`, `lessons.test.ts` |
| Fortschritt: Status, Freischalten, wo es weitergeht, Bestwert | [`src/lib/games/sokoban/progress.ts`](../../src/lib/games/sokoban/progress.ts) | `progress.test.ts` |
| Szene aus dem Zustand (Figur, Kisten, Ziele, Markierungen, Pfeile, Schmuck); Konfetti | [`src/lib/games/sokoban/scene.ts`](../../src/lib/games/sokoban/scene.ts), [`confetti.ts`](../../src/lib/games/sokoban/confetti.ts) | `scene.test.ts`, `confetti.test.ts` |
| Schräge Kamera, Formen, Treffer, Modelle aus Quadern, Zufall | [`src/lib/games/oblique/`](../../src/lib/games/oblique/) (`camera.ts`, `geometry.ts`, `models.ts`, `rng.ts`) | `camera.test.ts`, `geometry.test.ts`, `models.test.ts` |
| Feine Texturen gegen die Schnittstelle `Pen`; dieselben Befehle als SVG für das App-Symbol | [`textures.ts`](../../src/lib/games/oblique/textures.ts), [`pen.ts`](../../src/lib/games/oblique/pen.ts), [`svg-pen.ts`](../../src/lib/games/oblique/svg-pen.ts) | `textures.test.ts`, `svg-pen.test.ts` |
| Die 15 Lektionen, Texte, Stil „An der Kaje“, Ausblick auf die Level | [`src/data/games/`](../../src/data/games/) (`lessons.ts`, `texts.ts`, `kaje.ts`, `teaser.ts`) | `lessons.test.ts`, `texts.test.ts`, `kaje.test.ts`, `teaser.test.ts` |
| Bildschirme per Hash | [`src/scripts/games/ks-router.ts`](../../src/scripts/games/ks-router.ts) | `ks-router.test.ts` |
| Eingabe: Tasten, Antippen (Wischen tut nichts), Steuerkreuz | [`src/scripts/games/ks-input.ts`](../../src/scripts/games/ks-input.ts) | `ks-input.test.ts`, `e2e/touch.spec.ts` |
| Speichern | [`src/scripts/games/ks-save.ts`](../../src/scripts/games/ks-save.ts) | `ks-save.test.ts` |
| Bildschirm bleibt an | [`src/scripts/games/wake-lock.ts`](../../src/scripts/games/wake-lock.ts) | `wake-lock.test.ts` |
| App-Updates an sicheren Stellen | [`src/scripts/games/pwa-update.ts`](../../src/scripts/games/pwa-update.ts), [`pwa-moment.ts`](../../src/scripts/games/pwa-moment.ts) | `pwa-update.test.ts`, `e2e/pwa-update.spec.ts` |
| Web Component, Bildschirme, Spielfeld, Menü, Zeichnen | [`ks-kistenschieber.ts`](../../src/scripts/games/ks-kistenschieber.ts), [`ks-screens.ts`](../../src/scripts/games/ks-screens.ts), [`ks-game.ts`](../../src/scripts/games/ks-game.ts), [`ks-menu.ts`](../../src/scripts/games/ks-menu.ts) (nachgeladen: Konfetti), [`render/`](../../src/scripts/games/render/) | Browser-Tests `e2e/site.spec.ts`, `e2e/game.spec.ts`, `e2e/touch.spec.ts`, `e2e/a11y.spec.ts` |
| Alle Bildschirme als HTML | [`src/components/KistenschieberGame.astro`](../../src/components/KistenschieberGame.astro) | „ohne JavaScript“ in `e2e/site.spec.ts` |

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Lektion** | Eines der 15 Felder der Einführung, mit Titel, Idee (für die Levelwahl), gespeicherter zugkürzester Lösung `sol` und deren Zügen und Schüben. Höchstens 10 Felder breit und 9 hoch. Kennung im Speicher `eN` (N = 1 … 15) |
| **Level** | Die 24 Level in zwei Kapiteln kommen mit einem eigenen Issue. Heute nur Ausblick in der Levelwahl, nicht spielbar |
| **Zug** | Ein Schritt der Figur auf ein Nachbarfeld, mit oder ohne Kiste. Laufen gegen die Wand (`bump`) und eine Kiste, hinter der kein Platz ist (`blocked`), sind keine Züge |
| **Schub** | Ein Zug, der eine Kiste ein Feld weiterschiebt |
| **festsitzend** | Eine Kiste, die nicht mehr auf ein Ziel kommen kann (Ecke ohne Ziel, Wand ohne Ziel). Sie bekommt einen roten Rand |
| **Sackgasse** | Stellung, aus der der Löser keine Lösung mehr findet |
| **Rückschlag** | Ein Neustart nach mindestens einem Zug oder ein Schub in eine Sackgasse oder auf eine festsitzende Kiste |
| **Status einer Lektion** | geschafft (selbst gelöst, Bestwert gespeichert) vor mit Lösung gesehen vor übersprungen vor offen. Jeder Status außer offen schaltet die nächste Lektion frei |
| **frei / gesperrt** | Lektion 1 ist immer frei, jede weitere, sobald die vorige nicht mehr offen ist |
| **Bildschirm** | Start, Levelwahl, gesperrte Lektion, Einstellungen, Spielfeld. Alle stehen als HTML in `<ks-kistenschieber>`; der Hash wählt einen |

## Ereignisse (Befehle an den Spielzustand)

Der Spielzustand (`state.ts`) ist ein reiner Reducer: Jede Funktion bekommt den Zustand und die Zeit (`now` in ms) und gibt einen neuen Zustand zurück. Meldungen sind Schlüssel, die Sätze stehen in `texts.ts`. Speichern, Konfetti-Teilchen und Zeichnen macht der Spielbildschirm (`ks-game.ts`).

| Ereignis | Funktion | Auslöser |
| --- | --- | --- |
| Schritt | `key(g, d, now)` | Pfeiltaste oder WASD, Steuerkreuz |
| Laufweg oder Laufweg plus Schub | `act(g, steps, now)`, `pushVia(g, id, d, now)` | Antippen eines Bodenfelds bzw. eines Pfeils |
| Takt | `tick(g, now)` | jedes Bild, solange etwas läuft |
| Zug zurück | `undo(g)` | Knopf „Zug zurück“, Z, Backspace |
| Neu starten | `restart(g)` | R, Menü „Neu starten“ |
| Nochmal | `again(g)` | Knopf „Nochmal“ nach dem Sieg |
| Tipp | `tip(g)` | Menü „Tipp“, H |
| Kiste wählen | `toggleSelect(g, id)` | Antippen einer Kiste |
| Lösung zeigen | `showSolution(g, now)`, beendet mit `stopAuto(g)` | Menü „Lösung zeigen“; jede Taste oder ein Tippen beendet es |

## Regeln

| Regel | Test |
| --- | --- |
| **Laufen:** Ein Schritt geht auf ein freies Nachbarfeld und zählt als Zug. Gegen die Wand gibt es nur einen kurzen Ruck (`bump`), kein Zug | `state.test.ts` |
| **Schieben:** Steht eine Kiste im Weg und ist dahinter Platz, rückt sie mit (Zug und Schub). Ist dahinter kein Platz, ruckt die Figur, das Schild sagt „Dahinter ist kein Platz für die Kiste.“, kein Zug | `state.test.ts`, „zählt keinen Zug“ in `e2e/game.spec.ts` |
| **Puffer:** Während einer Animation (Laufen 120 ms, Schub 170 ms, Ruck 160 ms) merkt sich das Spiel bis zu zwei Tasten. Ein Ruck und eine festsitzende Kiste leeren den Puffer | `state.test.ts` |
| **Weniger Bewegung:** Mit `prefers-reduced-motion` dauert jede Animation 1 ms, es gibt kein Konfetti und keine Karten, die sich heben | `state.test.ts`, „bei reduzierter Bewegung kein Konfetti“ in `e2e/game.spec.ts`, `e2e/site.spec.ts` |
| **Zug zurück:** nimmt den letzten Zug zurück, bis zu 500 Schnappschüsse. Am Anfang: „Ganz am Anfang, weiter zurück geht es nicht.“ Er räumt Animation, Puffer, Auswahl, Tipp und Konfetti weg und bestimmt festsitzende Kisten neu. Nach dem Sieg nimmt er den Sieg zurück | `state.test.ts`, `e2e/game.spec.ts` |
| **Neu starten:** stellt die Startstellung her und lässt sich mit „Zug zurück“ zurücknehmen („Neu gestartet. Mit „Zug zurück“ kommst du zum alten Stand.“). Bei 0 Zügen räumt es nur das Schild ab | `state.test.ts`, `e2e/game.spec.ts` |
| **Prüfung nach jedem Schub:** Sieg geht vor; sonst festsitzende Kiste (Warnung, roter Rand, Rückschlag), sonst Sackgasse laut Löser mit Grenze 20000 (Warnung „So geht es nicht mehr auf. …“, Rückschlag), sonst still (eine Kiste auf dem Ziel zeigt es selbst). Die nächste Aktion räumt das Schild ab, eine Warnung bleibt stehen; sitzt eine Kiste fest, kommt ihre Warnung zurück | `state.test.ts`, `e2e/game.spec.ts` |
| **Schild:** Es spricht nur, wenn es etwas zu sagen gibt (Warnung, „Dahinter ist kein Platz …“, Tipp, „Geschafft!“, Vorspielen, „Ganz am Anfang …“, „Neu gestartet …“); eine Lektion beginnt leer, es gibt keine Lektionshinweise. Leer ist es unsichtbar, bleibt aber als Live-Region (`aria-live="polite"`) im Baum. Schild und Knöpfe danach (Angebot, „Weiter …“, „Nochmal“) liegen nie auf der Insel und ändern die Größe des Felds nicht: hochkant im Himmel direkt über der Insel (oben hält das Feld dafür immer Platz frei), quer in der Spalte neben dem Feld über „Zug zurück“; nach dem Sieg macht das Steuerkreuz dort Platz. Tippen geht durch die leere Fläche hindurch | `state.test.ts`, `texts.test.ts`, `lessons.test.ts`, „liegen nie auf der Insel“ in `e2e/game.spec.ts`, „quer 667×375“ in `e2e/touch.spec.ts` |
| **Überspringen anbieten:** Nach dem dritten Rückschlag erscheint beim Schild genau einmal „Zu knifflig? Überspringen“ | `state.test.ts`, `e2e/game.spec.ts` |
| **Sieg:** Stehen alle Kisten auf Zielen: „Geschafft! N Züge, kürzer geht es nicht.“ bzw. „…, am kürzesten wären M.“; nach Lektion 15 dazu „Damit ist die Einführung geschafft.“ Danach tun Schritte, Tippen aufs Feld und Tipp nichts mehr; Zug zurück, R (Neu starten) und M/Esc (Menü) gehen weiter, Enter (nicht auf einem Knopf oder Link) führt weiter | `state.test.ts`, `texts.test.ts`, `ks-input.test.ts`, `e2e/game.spec.ts` |
| **Weiter:** nach Lektion N zu `#lektion-(N+1)`, nach Lektion 15 „Zu den Lektionen“ (`#level`) | `ks-router.test.ts`, `texts.test.ts`, `e2e/game.spec.ts` |
| **Bestwert:** Ein eigener Sieg speichert Züge und Schübe, wenn er der erste ist, weniger Züge hat oder gleich viele Züge mit weniger Schüben. Ein vorgespielter Sieg zählt nie | `progress.test.ts`, `e2e/game.spec.ts` |
| **Tipp:** Der Löser (Grenze 60000) wählt die Kiste (erster Schub einer schubkürzesten Lösung, also erlaubt und danach noch lösbar) und zeigt nur diesen einen türkisen Pfeil, größer und hell gesäumt, keine anderen Richtungen der Kiste; Schild „Tipp: Diese Kiste in Pfeilrichtung schieben.“ Aus einer Sackgasse: „Von hier aus geht es nicht mehr. …“ als Warnung; zu groß für die Grenze: „Das ist zu verzwickt für einen schnellen Tipp.“ Der Tipp bleibt nur für dieselbe Kiste | `state.test.ts`, `scene.test.ts`, `lessons.test.ts`, `e2e/game.spec.ts` |
| **Lösung zeigen:** merkt die Lektion sofort als „mit Lösung gesehen“ und spielt vom Start die gespeicherte Lösung vor (1,3-mal langsamer), mitten in der Lektion Schub für Schub mit dem Löser. Aus einer Sackgasse oder nach einem Sieg geht es erst still zum Start. Am Ende: „So geht es. Jetzt du? …“, kein Bestwert, kein Konfetti. Eine Taste, ein Tippen oder das Menü beendet das Vorspielen | `state.test.ts`, `lessons.test.ts`, `e2e/game.spec.ts` |
| **Überspringen:** Menü „Lektion überspringen“ oder das Angebot merkt „übersprungen“ (nicht, wenn es schon einen Bestwert gibt) und öffnet die nächste Lektion, nach Lektion 15 die Levelwahl | `progress.test.ts`, `e2e/game.spec.ts` |
| **Freischalten:** der Reihe nach. Geschafft, übersprungen und mit Lösung gesehen machen die nächste frei, nie die übernächste | `progress.test.ts`, `e2e/site.spec.ts` |
| **Gesperrte Lektion:** `#lektion-N` einer gesperrten Lektion zeigt „Diese Lektion ist noch zu“ mit dem Knopf zur ersten offenen Lektion; sie wird nicht als letzte gemerkt | `texts.test.ts`, `progress.test.ts`, `e2e/site.spec.ts`, `e2e/game.spec.ts` |
| **Antippen:** Ein erreichbares Bodenfeld: Die Figur läuft hin, als ein Zug zum Zurücknehmen. Eine Kiste: goldener Rand und goldene Pfeile in jede mögliche Richtung (grau, wenn sie in eine Sackgasse führt); noch einmal hebt die Wahl auf; ohne Möglichkeit „Diese Kiste lässt sich gerade nirgendwohin schieben.“ Ein gezeigter Pfeil: hinlaufen und schieben; mit Tipp ist nur sein Pfeil antippbar, die anderen Felder um die Kiste sind gewöhnlicher Boden (`arrowDirs`, dieselbe Liste wie beim Zeichnen) | `ks-input.test.ts`, `state.test.ts`, `scene.test.ts`, `e2e/touch.spec.ts` |
| **Wischen:** Bis 28 px Weg ist es ein Tippen; ein längerer Wisch macht keinen Schritt und tippt nichts an. Kein Handler fängt Pointer- oder Touch-Ereignisse ab, Feld und Spielfläche haben `touch-action: manipulation` (Scrollen ja, Doppeltipp-Zoom nein): Der Finger scrollt die Seite, wenn sie höher als der Bildschirm ist | `ks-input.test.ts`, „ein Wisch macht keinen Schritt“ und „Wischen auf dem Feld scrollt die Seite“ in `e2e/touch.spec.ts` |
| **Steuerkreuz:** nur mit Touch (Gerät mit grobem Zeiger oder nach dem ersten Antippen; eine Pfeiltaste blendet es aus, Klasse `touch` an `<html>`, `ks-touch.ts`), Pfeile in die Bildschirmrichtung der Kamera gedreht, Seite nach der Einstellung „Hand“ | `ks-input.test.ts`, `e2e/touch.spec.ts` |
| **Tasten:** Pfeile und WASD laufen, Z und Backspace Zug zurück, R neu, H Tipp, M Menü, Esc hebt erst eine Auswahl auf, dann öffnet es das Menü. Mit Alt, Strg oder Meta, in Formularfeldern und bei offenem Menü zählen sie nicht | `ks-input.test.ts`, `e2e/game.spec.ts` |
| **Menü im Spiel:** Weiterspielen, Neu starten, Tipp, Lösung zeigen, Lektion überspringen, Lektion wählen, Einstellungen, Startbildschirm und die Notiz, als modaler Dialog mit Fokusfalle. Ein Bildschirmwechsel schließt es; es geht auch, wenn der nachgeladene Teil fehlt | `texts.test.ts`, `e2e/game.spec.ts` |
| **Startbildschirm:** zwei klar getrennte Teile. „Einführung“ mit Pille „jetzt spielbar“, Unterzeile „Lernen in 15 Lektionen“, „x von 15 Lektionen geschafft“ (mit noch fehlenden übersprungenen: „…, y übersprungen“) und dem einzigen goldenen Knopf (`startPoint`): „Spielen“, solange nichts angefangen ist, sonst „Weiterspielen: Lektion N“ (zuletzt geöffnete freie Lektion, sonst die erste offene; ist keine mehr offen, die erste übersprungene, damit der Knopf zum Haken führt). Ist die Einführung geschafft (`introComplete`: jede Lektion selbst gelöst oder mit Lösung gesehen; Übersprungenes zählt nicht, es bleibt zum Nachholen), steht dort „✓ geschafft“ (Haken mit Text, grün), „Alle 15 Lektionen erledigt.“ und „Einführung wiederholen“ (`#lektion-1`), solange zuletzt Lektion 15 oder keine geöffnet war; läuft eine Wiederholung (zuletzt Lektion 1 bis 14), bleibt es beim Haken mit „Weiterspielen: Lektion N“. Daneben bzw. darunter „Level“ mit Pille „kommen bald“, „Noch nicht spielbar.“ und den Kapiteln 1 und 2 mit Level 1 bis 24: gedämpft (Text in `--soft`, dunkel tiefer als die Einführung) und gestrichelt, ohne Gold, ohne Link oder Knopf; die Pille „jetzt spielbar“ sieht anders aus als „kommen bald“. Darunter „Lektion wählen“ (der Bildschirm zeigt nur Lektionen; „Level“ heißt nur, was noch nicht spielbar ist) und „Einstellungen“. Handy hochkant (390×844) und quer (844×390, 667×375) passt der ganze Start ohne Scrollen, quer links Titel, Szene und Nebenknöpfe, rechts die beiden Teile; auf kleineren Handys mindestens der große Knopf | `progress.test.ts`, `texts.test.ts`, `teaser.test.ts`, `e2e/site.spec.ts`, `e2e/a11y.spec.ts` |
| **Bildschirme per Hash:** leer, `#start`, `#spiel` Start; `#level` Levelwahl; `#einstellungen`; `#lektion-1` bis `#lektion-15`. `#level-N` wird zu `#level`, Unbekanntes zum Start, beides ohne neuen Eintrag im Verlauf. Tab-Titel „X · Kistenschieber“. Nach einem Wechsel steht die Seite oben, der Fokus liegt auf der Überschrift bzw. im Spiel auf dem Feld | `ks-router.test.ts`, `e2e/site.spec.ts` |
| **Rahmen ums Feld:** Der goldene Fokusrahmen des Spielfelds erscheint nur, wenn es mit Tab angesteuert wurde; Klicken, Tippen und Pfeiltasten zeigen keinen (sonst läge das Feld beim Spielen ständig im Rahmen) | `e2e/game.spec.ts` |
| **Einstellungen:** Drehung 0–45° (Standard 20°), Neigung 20–80° (Standard 50°) mit Vorschau, wirken sofort und bleiben gespeichert; „Zurücksetzen“. Ein Regler gibt nach der Änderung den Fokus ab. Die Handwahl gibt es nur mit Touch | `ks-save.test.ts`, `camera.test.ts`, `e2e/site.spec.ts` |
| **Bildschirm bleibt an:** Auf dem Spielfeld fordert das Spiel einen Wake Lock an, solange die Seite zu sehen ist; beim Verlassen und Verstecken gibt es ihn frei, beim Zurückkommen fordert es neu an. Fehler bleiben still | `wake-lock.test.ts`, `e2e/game.spec.ts` |
| **Lektionen:** 15 Felder wörtlich aus dem Entwurf; jede gespeicherte Lösung gewinnt mit genau ihren Zügen und Schüben, der Löser findet von jeder Startstellung unter der Grenze 20000 einen ersten Schub | `lessons.test.ts` |

## Invarianten

- Keine Funktion des Spielzustands verändert ihren Eingabezustand. *„Reinheit“ in `state.test.ts`*
- Jede Lektion ist lösbar, ihre gespeicherte Lösung ist zugkürzest gezählt, und der Löser schafft sie Schub für Schub mit höchstens so vielen Schüben. *`lessons.test.ts`*
- Der Löser arbeitet in Grenzen statt nach Uhrzeit: Der Test zählt die bekannten Stellungen, nicht die Millisekunden. *`lessons.test.ts`*
- Gespeichert wird nur, was geprüft gelesen werden kann; ein Speicher, der Fehler wirft, liefert die Standardwerte, das Spiel läuft weiter. *`ks-save.test.ts`*
- Seiten außer dem Spiel (404) laden kein Spiel und melden keinen Service Worker an. *Bundle-Gate (`scripts/bundles.test.ts`)*
- Kein Three.js und kein WebGL auf der Spielseite; der Kern bleibt im Budget, Menü-Konfetti und Anmeldung des Service Workers kommen nachgeladen. *Bundle-Gate, `scripts/guards.test.ts`*
- Ohne JavaScript bleibt die Seite als Dokument lesbar (Titel, die 15 Lektionen mit Idee, ein `<noscript>`-Hinweis, dass das Spiel JavaScript braucht); Spielfeld und Einstellungen sind dann ausgeblendet. *„ohne JavaScript“ in `e2e/site.spec.ts`*
- Barrierefreiheit nach WCAG 2.2 AA auf jedem Bildschirm und Zustand, hell und dunkel. *`e2e/a11y.spec.ts`*
- Alle Knöpfe sind auf Handy und Tablet mindestens 48 px groß, nichts scrollt quer, das Spielfeld passt hoch und quer ohne Scrollen. Nur unter seiner Mindesthöhe (hochkant 35rem, quer 20rem) wird die Seite höher als der Bildschirm und lässt sich scrollen, auch mit dem Finger auf dem Feld; so bleibt die Insel ganz zu sehen und ein Feld der Einführung hochkant mindestens 24 px groß (bis 600 px Höhe kleineres Steuerkreuz und 7.5rem statt 8.5rem Himmel für Meldungen). Ziehen zum Neuladen ist beim Spielen aus (`overscroll-behavior: none` am Wurzelelement, nur dort gilt es für den Viewport). *`e2e/touch.spec.ts`, `e2e/game.spec.ts`*

## App (installieren und ohne Netz spielen)

Das Spiel lässt sich als App auf den Home-Bildschirm legen und startet danach auch ohne Netz. Code und Regeln stammen aus dem Weltenbummler.

| Was | Regel |
| --- | --- |
| Manifest | `/manifest.webmanifest`, beim Build aus `src/data/pwa.ts` erzeugt: Name „Kistenschieber“, kurz „Kisten“, `lang` de, `id`, `start_url` und `scope` `/`, `display` standalone, Farben `--water-1`. Keine `orientation`: Das Spiel dreht sich mit dem Gerät |
| Icons | Die Kiste des Kais im Standard-Blickwinkel auf einem Verlauf in Wasserblau, beim Build gerendert: 192 und 512 px (Radius 22 %, Kiste 62 % breit), maskierbar 512 px (ohne Rundung, Kiste 48 %, bleibt im sicheren Kreis von 80 %); `apple-touch-icon`, Favicon und Vorschaubild ebenso |
| Kopfdaten | Verweis aufs Manifest, `theme-color` hell `#8dd0ee` und dunkel `#13213a`, `apple-mobile-web-app-*`, `viewport-fit=cover` |
| Service Worker | `/sw.js`, gilt für die ganze Adresse `/`. Angemeldet nur von der Spielseite, nach dem Laden, nur im fertigen Build, nachgeladen nach dem Kern, mit `updateViaCache: 'none'` |
| Vorab gespeichert | alles, was `/` lädt: Seite, Kern, nachgeladene Teile, Stylesheets, Schriften, Icons, Manifest. Die Liste entsteht beim Build und bleibt im Budget `PRECACHE_BUDGET` |
| Caches | Name `kistenschieber-<Version>`, die Version ist ein Hash über Pfade und Inhalte. Alte `kistenschieber-*`-Caches löscht erst die aktive neue Version, und nur, wenn keine Spielseite mehr offen ist |
| Dauerhafter Speicher | Als installierte App (`display-mode: standalone` oder `navigator.standalone`) bittet die Seite still um `navigator.storage.persist()`. Im Browser-Tab nicht, weil Firefox dort mit einem Dialog nachfragt |
| Wake Lock | siehe Regel „Bildschirm bleibt an“; speichert nichts |

| Regel | Test |
| --- | --- |
| Manifest ohne Fehler, Icons in den richtigen Größen, Farben aus `tokens.css` | `src/data/pwa.test.ts`, `manifest.test.ts`, `scripts/pwa.test.ts`, „Manifest“ in `e2e/site.spec.ts` |
| Das Spiel ist für Chromium installierbar, mit Gegenprobe | `e2e/installable.spec.ts` |
| Das Symbol zeigt die Kiste, die maskierbare Fassung bleibt in der sicheren Zone | `icon.test.ts`, `src/data/pwa.test.ts` |
| Der Service Worker bedient nur GET auf der eigenen Seite, speichert beim Installieren alles am HTTP-Cache vorbei und räumt nur eigene alte Caches weg | `sw.test.ts`, `precache.test.ts` |
| Die Liste enthält alles, was `/` lädt, und bleibt im Budget | `scripts/pwa.test.ts`, App-Gate `npm run verify:pwa` |
| Ohne Netz startet `/`, der nachgeladene Teil kommt aus dem Service Worker, Lektion 1 lässt sich lösen | `e2e/pwa.spec.ts` |

### Updates an sicheren Stellen

Rein in `pwa-update.ts` (Daten für den Kern in `pwa-moment.ts`), angewandt in `pwa-register.ts`. Kein Hinweis für das Kind, Eltern müssen nichts tun.

| Regel | Test |
| --- | --- |
| **Sicherer Moment:** Startbildschirm, Levelwahl, gesperrte Lektion, Einstellungen oder nach „Geschafft!“ (selbst gelöst, nicht vorgespielt) nach `WIN_MS` (2 s, das Konfetti ist verflogen). Nie mitten in einer Lektion, nie bei offenem Menü, nie ohne dauerhaften `localStorage`, nie bei verborgener Seite | `pwa-update.test.ts`, `e2e/pwa-update.spec.ts` |
| **Auslöser:** Ein sicherer Moment beginnt (Ereignis `kistenschieber-ruhe`), die Seite startet in einem, oder sie kommt nach mindestens `LONG_PAUSE` (30 Minuten) verborgen zurück | `pwa-update.test.ts`, `e2e/pwa-update.spec.ts` |
| **Übernehmen:** Wartet eine neue Version und ist der Moment sicher, innerhalb von `ARM_MS` (60 s) nach einem Auslöser, bittet die Seite sie um `skipWaiting` | `pwa-update.test.ts` |
| **Neu laden:** Sobald die neue Version übernimmt, prüft die Seite den Moment noch einmal und lädt dann einmal neu; nach „Geschafft!“ mit der nächsten Lektion, wie nach „Weiter“. Hat das Kind dazwischen eine Lektion geöffnet, erst beim nächsten sicheren Moment | `pwa-update.test.ts`, `e2e/pwa-update.spec.ts` |
| **Keine Schleife:** neu geladen nur auf eigene Bitte und höchstens einmal in `APPLY_GAP` (10 Minuten) | `pwa-update.test.ts` |
| **Mehrere Tabs:** Ein zweiter, alter Tab spielt ungestört weiter und bekommt seinen alten nachgeladenen Teil bis zuletzt | `sw.test.ts`, `e2e/pwa-update.spec.ts` |

Der Browser-Test arbeitet mit zwei echten Fassungen der Seite: `e2e/versions.ts` leitet vor dem Test aus `dist/` eine zweite ab, deren nachgeladener Teil `ks-menu` einen neuen Namen bekommt (`e2e/versions-dirs.ts`); der Test-Server `e2e/serve.ts` liefert sie mit dem Cookie `ks-version`.

## Speichern

Alles liegt nur im `localStorage` des Geräts, jeder Schlüssel mit dem Präfix `kistenschieber.`, jeder Wert als JSON. Nichts verlässt das Gerät.

| Schlüssel | Wert | Regel |
| --- | --- | --- |
| `kistenschieber.drehung` | Zahl 0–45 | Drehung der Kamera, Standard 20 |
| `kistenschieber.neigung` | Zahl 20–80 | Neigung der Kamera, Standard 50 |
| `kistenschieber.hand` | `"rechts"` oder `"links"` | Seite des Steuerkreuzes, Standard rechts |
| `kistenschieber.best.eN` | `{ "moves": …, "pushes": … }` | Bestwert der Lektion N: ganze Zahlen, mindestens ein Zug, nicht mehr Schübe als Züge |
| `kistenschieber.skip.eN` | `true` | Lektion N übersprungen |
| `kistenschieber.shown.eN` | `true` | Lektion N mit Lösung gesehen |
| `kistenschieber.last` | `"eN"` | zuletzt geöffnete freie Lektion, Ziel von „Weiterspielen“ |
| `kistenschieber.probe` | `1` | nur beim Start kurz geschrieben und sofort gelöscht, prüft, ob der Speicher geht (`browser-store.ts`) |

| Was | Regel |
| --- | --- |
| Wann | Einstellungen sofort bei jeder Änderung; Bestwert beim Sieg, „mit Lösung gesehen“ beim Start des Vorspielens, „übersprungen“ beim Überspringen, `last` beim Öffnen einer freien Lektion |
| Prüfung | Fehlendes oder Ungültiges (falscher Typ, außerhalb der Grenzen, `last` nicht der Form `eN`) ergibt den Standardwert |
| Fehler | Jeder Zugriff fängt Fehler ab. Ohne Speicher (privates Fenster, gesperrt) spielt das Spiel im Speicher des Tabs weiter (`browser-store.ts`) |
| Format | Keine Migration: Die App ist neu, Stände aus dem Entwurf werden nicht übernommen. Ändert sich das Format, gehört eine Migration mit Test in `ks-save.ts` |
| Sonst | Der Service Worker legt Caches `kistenschieber-*` an (nur Dateien des Spiels); `sessionStorage` merkt sich nur, wann zuletzt für ein Update neu geladen wurde |

*Tests: `ks-save.test.ts`, `progress.test.ts`, `e2e/site.spec.ts`, `e2e/game.spec.ts`*

## Was angezeigt wird

| Was | Regel |
| --- | --- |
| Grafik | Nur die feine Grafik des Entwurfs im Stil „An der Kaje“ (`docs/design-system.md`): Boden roter Klinker, Mauern halbhoch heller Granit mit Kaimauer, Kisten Holz mit blauem Rahmen (auf dem Ziel grün mit Haken), Ziele gelber Rahmen mit dunklem Kern, ringsum Wasser, Poller und eine Möwe als Schmuck. Die Figur ist Frauke |
| Kamera | Schräg von oben mit Drehung und Neigung aus den Einstellungen. Unter 560 px Breite fällt der Wasserrand weg |
| Zustände | Jeder Zustand hat eine eigene Form, nicht nur eine Farbe: Haken auf der Kiste am Ziel, goldener Rand und Pfeile bei der gewählten Kiste, türkiser Pfeil beim Tipp, grauer Pfeil in eine Sackgasse, roter Rand bei einer festsitzenden Kiste |
| Spielfeld | Oben Menü-Knopf, Titel „Lektion N: Titel“ und Zähler „N Züge“; darunter das Feld (Canvas `role=img`, fokussierbar, beschriftet), das Schild (`aria-live`) und nach dem Sieg „Weiter …“ und „Nochmal“, unten nur „Zug zurück“ (Tipp im Menü und mit H). Hochkant Knöpfe unter dem Feld (Zug zurück mittig neben dem Steuerkreuz), die Insel unten im Himmel direkt über den Knöpfen, Schild und Knöpfe nach dem Sieg im Himmel direkt über der Insel; quer eine Spalte neben dem Feld mit Schild und Knöpfen oben, „Zug zurück“ und Steuerkreuz unten nebeneinander. Safe Areas, kein Zoom per Doppeltipp, kein Ziehen zum Neuladen |
| Konfetti | Nach einem eigenen Sieg 18 Teilchen je Kiste in den Farben des Kais, verglühen nach 1,4 s; „Zug zurück“, „Neu starten“ und „Nochmal“ räumen es sofort weg |
| Levelwahl | Überschrift „Lektion wählen“ (Tab-Titel ebenso, Hash `#level`) mit Leittext samt „Spielbar ist bisher nur die Einführung, die Level kommen bald.“; „Einführung“ mit Pille „15 Lektionen“ bzw. „✓ geschafft“ (dieselbe Regel und derselbe Haken wie auf dem Startbildschirm); je Lektion eine Karte mit Vorschau, Titel, Kistenzahl und kürzestem Weg, Zeile je Status (✓ geschafft, ↷ übersprungen, mit Lösung gesehen, „Noch zu“ ausgegraut); die Lektion, die dran ist, mit goldenem Rahmen. Darunter dieselbe gestrichelte Karte wie auf dem Startbildschirm: „Level“ mit Pille „kommen bald“, „Noch nicht spielbar.“ und nur die Kapitel 1 „Am Kai“ und 2 „Im Speicher“, ohne Links |
| Einstellungen | „Ansicht“ mit den Reglern Drehung und Neigung und Vorschau, „Bedienung“ (Handwahl, nur mit Touch), „Als App installieren“ mit der Anleitung aus dem Entwurf |
| Dunkel | Mit `prefers-color-scheme: dark` wechseln Himmel, Flächen und Rahmen; Knöpfe, Schild und Zähler bleiben hell mit dunkler Schrift; nur „Lektion wählen“ und „Einstellungen“ auf dem Start liegen dunkel (`--card`, Rand `--frame`), damit Gold der einzige starke Akzent bleibt |

## Bewusst anders als im Entwurf

- Nur die Einführung ist spielbar; nach Lektion 15 führt „Zu den Lektionen“ statt „Weiter zu Level 1“, `#level-N` wird zu `#level`. Kein Schlüssel `intro.skip`, kein Knopf „Einführung überspringen“.
- `storage.persist()` nur als installierte App, still (Weltenbummler-Regel); der Entwurf sagt nur „bittet die App darum“, ohne Einschränkung; hier nur als installierte App, weil Firefox im Tab mit einem Dialog nachfragt.
- Startbildschirm in zwei Teilen (Issue #13): Im Entwurf standen nur der große Knopf und die Zeile „Einführung: x von 15 Lektionen geschafft“ bzw. „Level: x von 24 geschafft“, sodass nicht zu sehen war, dass nur die Einführung spielbar ist. Hier stehen „Einführung“ (jetzt spielbar, Fortschritt, Knopf) und „Level“ (kommen bald, nicht spielbar, kein Link) nebeneinander bzw. untereinander. Geschafft ist die Einführung mit „✓ geschafft“, wenn jede Lektion selbst gelöst oder mit Lösung gesehen ist; der Entwurf nannte sie „abgeschlossen“, sobald keine mehr offen war, auch nur übersprungen. Dann heißt der große Knopf „Einführung wiederholen“. Der Bildschirm „Level wählen“ des Entwurfs heißt hier „Lektion wählen“ (auch im Menü, nach Lektion 15 „Zu den Lektionen“), weil er nur Lektionen zeigt.
- Der Ausblick in der Levelwahl zeigt nur Kapitel 1 „Am Kai“ und 2 „Im Speicher“, ohne Links; die Kapitel 3 bis 9 („Plan bis 100“) bleiben im Entwurf.
- Nach „Dahinter ist kein Platz für die Kiste.“ räumt erst die nächste Aktion das Schild ab; im Entwurf überschrieb das Intro die Meldung sofort, wenn eine Taste direkt blockierte.
- Keine Lektionshinweise (Intro je Lektion) und kein „Die Kiste steht.“ auf dem Schild: Sie nahmen auf dem Handy nur Platz weg. Das Schild erscheint nur mit einer Meldung und hat keine eigene Zeile unter dem Feld mehr: hochkant liegt es im Himmel über der Insel, quer in der Spalte neben dem Feld (Issue #11).
- Startlinks zeigen auf `#start` (der Entwurf nutzt `#spiel`, das weiter funktioniert).
- Nur die feine Grafik; Pixel, Glatt und die Ansicht von vorn bleiben im Entwurf. Kein Hilfetext unter dem Feld.
- Keine Migration alter Stände aus dem Entwurf (`best.N`).
- Nach einem App-Update kommt die Seite nach „Geschafft!“ mit der nächsten Lektion zurück.
- Die Spielknöpfe (`.btn.gbtn`) bleiben auch bei niedriger Höhe 48 px hoch statt 44 px, damit jedes Ziel mindestens 48 px groß ist.
- Die Lektion, die dran ist, bekommt in der Levelwahl einen goldenen Rahmen statt der Goldfläche der Kachel aus der Menüführung; das Vorschaubild bleibt sichtbar.
- Die Statuszeile des Startbildschirms steht in `--text` statt `--muted` (sonst nur 4,46:1 auf dem Himmel), die Unterzeile gesperrter Karten in `--text` statt `--soft` (unter Deckkraft .62 sonst unter 4,5:1, axe).
- Kein Knopf „Tipp“ unter dem Feld (nur Menü und H), damit unten Platz bleibt; der Tipp zeigt nur seinen einen türkisen Pfeil statt aller Richtungen der Kiste (im Entwurf las sich das auf dem Handy wie „hoch oder runter“), und das Schild sagt kürzer „Tipp: Diese Kiste in Pfeilrichtung schieben.“ (Issue #14).
- Kein Wischen (Issue #12): Im Entwurf machte ein Wisch einen Schritt, und das Feld fing jeden Finger ab (`touch-action: none`, Seite `overflow: hidden`), sodass auf Handy und Tablet nichts scrollte. Hier laufen Antippen und Steuerkreuz, ein Wisch tut nichts, und die Seite darf scrollen; die Beschriftung des Felds sagt „Antippen oder Pfeiltasten bewegen die Figur.“
- Kein Sprunglink auf der Spielseite: `#inhalt` wäre ein unbekannter Hash und führte zum Start, vor dem Inhalt steht nichts.

## Haken für die Browser-Tests

Die Browser-Tests (`e2e/`, Playwright) zeichnen Bilder selbst, statt auf Uhrzeit oder eine Zahl von Bildern zu warten: In der Pipeline zeichnet die Seite ohne Grafikkarte, dort dauert jedes Bild ein Vielfaches.

| Was | Regel |
| --- | --- |
| Test-Uhr | `openGame(page, { clock: true })` (`e2e/helpers.ts`, Standard) setzt vor dem ersten Skript `window.__KS_TEST` und lässt `performance.now()` stehen. Mit `__KS_TEST` zeichnet die Komponente sofort statt im nächsten Bild und fordert kein nächstes Bild an |
| Bilder | `render(page, n, ms)`: n Bilder über `frame()` der Komponente, je Bild `ms` später (sonst 50 ms); `playLurd(page, lurd)` spielt Züge als Tasten samt Bildern |
| Steht | Klasse `ready` (Stand geladen, Bildschirme verdrahtet) und `settled` (erstes Bild des gezeigten Bildschirms gezeichnet; jeder Wechsel nimmt sie weg) an `<ks-kistenschieber>`; `openGame` und `reloadGame` warten auf `settled`. Klasse `extras` am Spielfeld, sobald der nachgeladene Teil da ist |
| Speicher | `seed(page, values)` belegt den Speicher einmal je Tab vor (Schlüssel ohne Präfix), `stored(page, key)` liest |
| Wake Lock | `fakeWakeLock(page)` ersetzt `navigator.wakeLock` (headless lehnt ab), `wakeLog(page)` liest mit |
| Live | Ohne Test-Uhr laufen nur „ohne Test-Uhr läuft der Takt von selbst bis „Geschafft!““ (`e2e/game.spec.ts`) und die Tests der App (`e2e/pwa.spec.ts`, `e2e/pwa-update.spec.ts`). Nur `e2e/pwa-update.spec.ts` hat eigene Fristen (60 s je Test, Polls bis 30 s), weil es echte Abläufe sind (zwei Fassungen, Installation, Neuladen); sie fangen nur Hänger ab |
| Projekte | `site` (`site.spec.ts`, `installable.spec.ts`), `game` (`game`, `touch`, `a11y`, `pwa`; Service Worker blockiert außer in `pwa.spec.ts`), `pwa-update` (ein Worker) in `playwright.config.ts` |
| Lint | In `e2e/` sind `waitForTimeout`, Helfer `frames`/`waitFrames` und `goto('/')` (auch mit `?…` oder `#…`) außerhalb von `e2e/helpers.ts` verboten (`eslint.config.js`) |
