// Web-App-Manifest: macht das Spiel installierbar („App installieren“, „Zum Home-Bildschirm“).
// Inhalte in src/data/pwa.ts, Aufbau in src/lib/pwa/manifest.ts.
import { webManifest } from '../lib/pwa/manifest';
import { APP, APP_ICONS } from '../data/pwa';

export function GET() {
  return new Response(JSON.stringify(webManifest(APP, [...APP_ICONS]), null, 2), {
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}
