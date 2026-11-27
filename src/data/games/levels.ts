// Die Level nach der Einführung, wörtlich aus dem Entwurf „Kistenschieber“ (Kapitel 1 „Am Kai“). Spielbar sind bisher
// Level 1 bis 6, reine Kistenlevel; Schranke und Schalter kommen erst ab Level 7. Sie gehen auf wie ein Adventskalender:
// Level N am N. Dezember 2026 um 0 Uhr deutscher Zeit.
// `sol` ist eine zugkürzeste Lösung in LURD (Großbuchstabe = Schub), `moves` ihre Länge, `pushes` die Zahl der Schübe.
import { dayStart } from '../../lib/games/calendar';

export interface LevelDef {
  readonly title: string;
  readonly moves: number;
  readonly pushes: number;
  readonly sol: string;
  /** Feld als XSB: # Wand, . Ziel, $ Kiste, * Kiste auf Ziel, @ Figur, + Figur auf Ziel */
  readonly xsb: string;
  /** Tag, an dem das Level aufgeht (JJJJ-MM-TT, deutsche Zeit) */
  readonly opens: string;
}

export interface LevelEntry extends LevelDef {
  /** Nummer ab 1 */
  readonly n: number;
  /** Sprungmarke und Hash: level-N */
  readonly id: string;
}

/** Zeitzone des Kalenders: Die Türchen gehen in Deutschland um Mitternacht auf, egal wie die Uhr des Geräts steht */
export const ADVENT_ZONE = 'Europe/Berlin';

const DEFS: readonly LevelDef[] = [
  {
    title: 'Anleger',
    moves: 25,
    pushes: 10,
    sol: 'ddddrrUdrUUUruLLrddLLdlUU',
    xsb: '#######\n#+.   #\n#  #  #\n#     #\n#  $$ #\n#    ##\n#######',
    opens: '2026-12-01',
  },
  {
    title: 'Poller',
    moves: 27,
    pushes: 11,
    sol: 'lDDDrdLLdlluuruRurDDrdLrdLL',
    xsb: '#######\n#### @#\n### $ #\n## $ ##\n#  #  #\n# ..  #\n# . $ #\n#######',
    opens: '2026-12-02',
  },
  {
    title: 'Laufsteg',
    moves: 47,
    pushes: 14,
    sol: 'uuurrrrrrddLLLLLuurrDurrrddllLLdlUrruurrDrdLLLL',
    xsb: '##########\n#        #\n#  .#$#$ #\n# ..   $ #\n##@  #####\n##########',
    opens: '2026-12-03',
  },
  {
    title: 'Taurolle',
    moves: 41,
    pushes: 16,
    sol: 'RRurDDDldRllUUluRRurDDDuuurrddLruulldDrdL',
    xsb: '########\n##     #\n#@$  # #\n#  # $ #\n##$.  ##\n##  ..##\n########',
    opens: '2026-12-04',
  },
  {
    title: 'Ladekante',
    moves: 25,
    pushes: 9,
    sol: 'ddddrUUUrrrddLUUllddRdrUU',
    xsb: '#######\n#@. . #\n#   . #\n#  #$ #\n# $ $ #\n#     #\n#######',
    opens: '2026-12-05',
  },
  {
    title: 'Hafenbecken',
    moves: 31,
    pushes: 10,
    sol: 'uurrrdLLLdlUlldRlddrUURlddrruUU',
    xsb: '#########\n#  ..   #\n# .   $ #\n# $ @####\n# $# ####\n#    ####\n#########',
    opens: '2026-12-06',
  },
];

export const LEVELS: readonly LevelEntry[] = DEFS.map((d, i) => ({ ...d, n: i + 1, id: `level-${i + 1}` }));

/** Ab wann Level n spielbar ist (ms seit 1970); ein unbekanntes Level nie */
export function opensAt(n: number): number {
  const l = LEVELS[n - 1];
  return l ? dayStart(l.opens, ADVENT_ZONE) : Infinity;
}

/** Ist der Tag von Level n gekommen? */
export const isOpen = (n: number, now: number): boolean => now >= opensAt(n);

/** Zahl der Level, deren Tag gekommen ist (sie gehen der Reihe nach auf) */
export function openCount(now: number): number {
  let k = 0;
  while (k < LEVELS.length && isOpen(k + 1, now)) k++;
  return k;
}
