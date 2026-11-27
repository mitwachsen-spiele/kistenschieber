// Das App-Symbol als Parameter für den Icon-Zeichner (src/lib/voxel/icon.ts): die Kiste des Kais im Standard-Blickwinkel
// auf Wasserblau, Maße aus src/data/pwa.ts. Nur beim Build (Icons, Favicon, Vorschaubild).
import { CAM_DEFAULT, makeCamera } from '../lib/games/oblique/camera';
import type { BlockIcon } from '../lib/voxel/icon';
import { KAJE_BLOCKS } from './games/kaje';
import { ICON_LOOK, WATER_1, WATER_2 } from './pwa';

/** Das Symbol für Icons ohne Maske (`any`, auch Favicon) oder mit Maske */
export const appIcon = (purpose: keyof typeof ICON_LOOK): BlockIcon => ({
  faces: KAJE_BLOCKS.crate,
  cam: makeCamera(CAM_DEFAULT.yaw, CAM_DEFAULT.tilt),
  from: WATER_1,
  to: WATER_2,
  ...ICON_LOOK[purpose],
});
