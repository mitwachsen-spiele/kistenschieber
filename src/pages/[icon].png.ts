// PNG-Icons: das apple-touch-icon (180 × 180) und die Icons der App aus dem Manifest (src/data/pwa.ts), alle beim
// Build gerendert: die Kiste auf Wasserblau. Das apple-touch-icon ohne Rundung und ohne Durchsicht (iOS rundet selbst).
import { iconPng, type BlockIcon } from '../lib/voxel/icon';
import { APP_ICONS } from '../data/pwa';
import { appIcon } from '../data/app-icon';

const ICONS: Record<string, { size: number; icon: BlockIcon }> = {
  'apple-touch-icon': { size: 180, icon: { ...appIcon('any'), radius: 0 } },
  ...Object.fromEntries(
    APP_ICONS.map((i) => [i.file.replace(/\.png$/, ''), { size: i.size, icon: appIcon(i.purpose) }]),
  ),
};

export function getStaticPaths() {
  return Object.keys(ICONS).map((icon) => ({ params: { icon } }));
}

export async function GET({ params }: { params: { icon: string } }) {
  const icon = ICONS[params.icon];
  if (!icon) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(await iconPng(icon.size, icon.icon)), {
    headers: { 'Content-Type': 'image/png' },
  });
}
