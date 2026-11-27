// Das Spiel als installierbare App (PWA): Manifest, Icons und Service Worker. Spec: docs/specs/kistenschieber.md („App“).
// Wird auch im Browser gelesen (Anmeldung des Service Workers), darum nur Daten, keine Imports.

/** Wasserblau wie in src/styles/tokens.css (--water-1, --water-2); ein Test prüft, dass sie übereinstimmen */
export const WATER_1 = '#8dd0ee';
export const WATER_2 = '#3f8fc2';

export const APP = {
  name: 'Kistenschieber',
  shortName: 'Kisten',
  description: 'Kisten auf die gelben Felder schieben, in Ruhe und ohne Uhr. Ein Spiel von mitwachsen-spiele.de.',
  lang: 'de',
  startUrl: '/',
  scope: '/',
  // standalone: ohne Browserleisten, Uhr und Akku bleiben sichtbar
  display: 'standalone',
  themeColor: WATER_1,
  backgroundColor: WATER_1,
} as const;

/** Icons der App: die Kiste auf Wasserblau; maskable ohne Rundung, die Kiste kleiner in der sicheren Zone */
export const APP_ICONS = [
  { file: 'icon-192.png', size: 192, purpose: 'any' },
  { file: 'icon-512.png', size: 512, purpose: 'any' },
  { file: 'icon-maskable-512.png', size: 512, purpose: 'maskable' },
] as const;

/**
 * Das App-Symbol wie im Entwurf: abgerundetes Quadrat (Radius 22 % der Kante), Verlauf von oben Wasserblau nach unten
 * dunkles Wasserblau, darauf die Kiste mit 62 % der Kantenbreite, mittig und um 2 % nach unten versetzt. Maskable:
 * vollflächig ohne Rundung (die Maske rundet selbst), die Kiste so klein, dass ihr Rahmen im Kreis der sicheren Zone
 * (80 %) bleibt. `fill` ist die Breite der Kiste als Anteil der Kante, `radius` und `dy` ebenso
 */
export const ICON_LOOK = {
  any: { radius: 0.22, fill: 0.62, dy: 0.02 },
  maskable: { radius: 0, fill: 0.48, dy: 0.02 },
} as const;

export const SERVICE_WORKER = {
  url: '/sw.js',
  scope: '/', // die ganze Adresse gehört dem Spiel
  entry: '/', // von dieser Seite aus wird gesammelt, was vorab gespeichert wird
  prefix: 'kistenschieber-', // Präfix der Caches, die der Service Worker anlegt und wieder löscht
} as const;
