// Stil „An der Kaje“, wörtlich aus dem Entwurf: welche Textur auf welchem Block liegt, Maße, Farben von Zielen,
// Markierungen, Schatten und Konfetti, die Figur Frauke und der Schmuck (Poller, Möwe).
import { type Look, type Part, eyes, pair } from '../../lib/games/oblique/models';
import { type BlockFaces, granit, kai, kiste, klinker, wasser, wasserSeite } from '../../lib/games/oblique/textures';

/** Tinte: Konturen und Zielrahmen */
export const INK = '#1d2838';

/** Mauerhöhe (halbhoch) */
export const WH = 0.5;
/** Kistengröße, mittig in der Zelle */
export const K = 0.8;
/** Oberkante des Wasserrands, 0,3 unter dem Boden */
export const RING_Z = -0.3;

export type BlockKind = 'floor' | 'wall' | 'crate' | 'crateOk' | 'ring';

/** Texturen je Block: Klinker auf Granit, Kaimauer, Kiste (auf dem Ziel grün mit Haken), Wasser */
export const KAJE_BLOCKS: Readonly<Record<BlockKind, BlockFaces>> = {
  floor: { top: klinker, side: granit },
  wall: { top: kai, side: granit },
  crate: { top: kiste(), side: kiste({ brace: true }) },
  crateOk: { top: kiste({ ok: true, check: true }), side: kiste({ ok: true, brace: true }) },
  ring: { top: wasser, side: wasserSeite },
};

/** Höhe der Blöcke (Boden, Kiste und Wasser ganze Blöcke, Mauer halbhoch) */
export const BLOCK_HEIGHT: Readonly<Record<BlockKind, number>> = { floor: 1, wall: WH, crate: 1, crateOk: 1, ring: 1 };

/** Ziel: drei flache Quadrate (halbe Kante, Farbe, Höhe) */
export const GOAL: readonly { readonly half: number; readonly col: string; readonly z: number }[] = [
  { half: 0.38, col: INK, z: 0.004 },
  { half: 0.31, col: '#ffd23f', z: 0.006 },
  { half: 0.15, col: INK, z: 0.008 },
];

/** Rand einer Kiste: ausgewählt, Tipp, festgefahren */
export const MARK = { sel: '#f0a531', hint: '#2ec4b6', stuck: '#e0442f' } as const;
/** Pfeile: Tipp, wählbar, führt in eine Sackgasse */
export const ARROW_FILL = { hint: '#2ec4b6', sel: '#f0a531', dead: '#a3aab3' } as const;
/** Größe der Pfeile (1 = Feld-Pfeil des Entwurfs): Der Tipp steht allein und muss auch auf dem Handy auffallen */
export const ARROW_SCALE = { hint: 1.5, sel: 1, dead: 1 } as const;
/** Heller Saum um den Tipp-Pfeil, damit er sich vom gelb-schwarzen Ziel abhebt */
export const ARROW_HALO = 'rgba(255,255,255,.9)';

/** Linienbreiten in px bei Maßstab 1: Markierung, Pfeil-Kontur, helle Oberkanten */
export const LINE = { mark: 3.2, arrow: 2.2, edge: 1.1 } as const;

/** Helle Oberkante von Mauer und Kiste */
export const EDGE = { wall: 'rgba(255,255,255,.38)', crate: 'rgba(255,255,255,.4)' } as const;

/** Schatten: am Boden vor Mauern (Verlauf), unter Kisten (drei Lagen) und unter der Figur (rund) */
export const SHADOW = {
  contact: { from: 'rgba(20,24,34,.32)', to: 'rgba(20,24,34,0)', edge: 0.5, inner: 0.2, z: 0.003 },
  crate: [
    { half: 0.56, alpha: 0.07 },
    { half: 0.5, alpha: 0.08 },
    { half: 0.45, alpha: 0.1 },
  ],
  crateRgb: '29,40,56',
  figure: { rx: 0.34, ry: 0.3, from: 'rgba(29,40,56,.34)', to: 'rgba(29,40,56,0)', z: 0.01 },
} as const;

/** Konfetti beim Sieg, reihum */
export const CONFETTI = ['#ffd23f', '#3c9656', '#ffffff', '#f0a531'] as const;

/** Frauke, die Stauerin */
export const FRAUKE: Look = {
  skin: '#f1c6a3',
  skinD: '#dea582',
  hand: '#f1c6a3',
  shoe: '#6e4527',
  shoeH: 0.1,
  legs: '#3b4150',
  hips: '#3b4150',
  torso: '#3e6e4c',
  sleeve: '#8db4d6',
  extra: (l) => [
    [0.078 + l, -0.045, 0.43, 0.012, 0.09, 0.22, '#8db4d6', null, 'f'],
    ...pair([0.083 + l, 0.075, 0.46, 0.008, 0.055, 0.045, '#2f5a3c', null, 'f']),
    [-0.165 + l, -0.155, 0.72, 0.08, 0.31, 0.24, '#b0582a'],
    [0.13 + l, -0.14, 0.89, 0.03, 0.28, 0.05, '#b0582a', null, 'f'],
    [-0.245 + l, -0.04, 0.6, 0.08, 0.08, 0.26, '#b0582a'],
    [-0.24 + l, -0.045, 0.84, 0.07, 0.09, 0.03, '#d6453b'],
    [-0.165 + l, -0.165, 0.9, 0.33, 0.33, 0.05, '#b8352d'],
    [-0.15 + l, -0.15, 0.95, 0.3, 0.3, 0.08, '#d6453b'],
    [-0.05 + l, -0.05, 1.03, 0.1, 0.1, 0.08, '#f3eee4'],
    [0.15 + l, -0.03, 0.735, 0.006, 0.06, 0.016, '#a0473a', null, 'f'],
    ...pair([0.15 + l, 0.088, 0.76, 0.008, 0.035, 0.025, '#ea9a8c', null, 'f']),
  ],
};

export const FRAUKE_TEXT =
  'Rote Wollmütze mit Bommel, Zopf, grüne Weste mit Taschen über hellblauem Hemd, feste Stiefel.';

/** Poller auf der Kaimauer */
export const BOLLARD: readonly Part[] = [
  [-0.12, -0.12, 0, 0.24, 0.24, 0.18, '#2e3440'],
  [-0.155, -0.155, 0.18, 0.31, 0.31, 0.06, '#3a414e'],
  [-0.1, -0.1, 0.24, 0.2, 0.2, 0.03, '#4a5262'],
];

/** Möwe (sitzt auf dem Poller oben rechts) */
export const GULL: readonly Part[] = [
  [-0.12, -0.06, 0.05, 0.22, 0.12, 0.1, '#f2f2ee'],
  [0.08, -0.045, 0.12, 0.09, 0.09, 0.08, '#ffffff'],
  [0.17, -0.015, 0.14, 0.06, 0.03, 0.025, '#f2b52c'],
  ...pair([-0.1, 0.06, 0.08, 0.17, 0.02, 0.07, '#9aa3ad']),
  [-0.18, -0.04, 0.08, 0.06, 0.08, 0.04, '#3b3f46'],
  ...pair([0.0, 0.01, 0, 0.02, 0.02, 0.05, '#f2b52c']),
  ...eyes(0.17, 0.045, 0.16, 0.02, 0.02, 0.012),
];

/** Was decoFor (sokoban/scene.ts) für den Kai braucht */
export const KAJE_DECO = { bollard: BOLLARD, gull: GULL, wallHeight: WH } as const;
