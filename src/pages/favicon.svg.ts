// Favicon: das App-Symbol (Kiste auf Wasserblau), beim Build erzeugt.
import { blockIconSvg } from '../lib/voxel/icon';
import { appIcon } from '../data/app-icon';

export function GET() {
  return new Response(blockIconSvg(64, appIcon('any')), { headers: { 'Content-Type': 'image/svg+xml' } });
}
