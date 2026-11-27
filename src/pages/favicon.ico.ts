// favicon.ico für Browser und Crawler, die danach fragen: das App-Symbol in 32 × 32.
import { iconIco } from '../lib/voxel/icon';
import { appIcon } from '../data/app-icon';

export async function GET() {
  return new Response(new Uint8Array(await iconIco(appIcon('any'))), { headers: { 'Content-Type': 'image/x-icon' } });
}
