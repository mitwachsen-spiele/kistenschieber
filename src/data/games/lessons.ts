// Die 15 Lektionen der Einführung, wörtlich aus dem Entwurf „Kistenschieber“ (XSB samt führender Leerzeichen).
// `sol` ist eine zugkürzeste Lösung in LURD (Großbuchstabe = Schub), `moves` ihre Länge, `pushes` die Zahl der Schübe.

export interface LessonDef {
  readonly title: string;
  readonly moves: number;
  readonly pushes: number;
  readonly sol: string;
  /** Kurzidee für die Levelwahl */
  readonly idea: string;
  /** Text auf dem Schild zu Beginn */
  readonly intro: string;
  /** Feld als XSB: # Wand, . Ziel, $ Kiste, * Kiste auf Ziel, @ Figur, + Figur auf Ziel */
  readonly xsb: string;
}

export interface Lesson extends LessonDef {
  /** Nummer ab 1 */
  readonly n: number;
  /** Sprungmarke und Hash: lektion-N */
  readonly id: string;
}

const DEFS: readonly LessonDef[] = [
  {
    title: 'Erster Schubs',
    moves: 9,
    pushes: 4,
    sol: 'rruulLLLL',
    idea: 'Laufen und schieben: eine Kiste, ein Ziel.',
    intro: 'Schieb die Kiste auf das gelbe Feld.',
    xsb: '#########\n#       #\n# ##### #\n#.   $  #\n# ##### #\n#    @  #\n#########',
  },
  {
    title: 'Um die Ecke',
    moves: 6,
    pushes: 4,
    sol: 'RurDDD',
    idea: 'Die Richtung wechseln: Dafür läuft man einmal um die Kiste herum.',
    intro: 'Die Kiste muss um die Ecke. Lauf um sie herum, dann schiebst du sie in die neue Richtung.',
    xsb: '######\n#    #\n#@$  #\n##   #\n #   #\n # . #\n #####',
  },
  {
    title: 'Zwei Kisten',
    moves: 14,
    pushes: 6,
    sol: 'uLdlUUdrrRdrUU',
    idea: 'Zwei Kisten, zwei Ziele; welche Kiste wohin kommt, ist egal.',
    intro: 'Zwei Kisten, zwei Ziele. Welche Kiste auf welches Ziel kommt, ist egal.',
    xsb: '#######\n#.   .#\n#     #\n# $ $ #\n#  @  #\n#######',
  },
  {
    title: 'Ecken sind Fallen',
    moves: 9,
    pushes: 5,
    sol: 'luRRRurDD',
    idea: 'Eine Kiste in einer Ecke kommt nie wieder heraus.',
    intro: 'Vorsicht mit Ecken: Steht eine Kiste in der Ecke, bekommst du sie nicht mehr heraus.',
    xsb: '########\n#      #\n#  $   #\n#  @   #\n#     .#\n########',
  },
  {
    title: 'An der Wand entlang',
    moves: 8,
    pushes: 4,
    sol: 'ulluRRRR',
    idea: 'Steht eine Kiste an der Wand, kann sie nur noch an ihr entlang.',
    intro: 'Diese Kiste steht an der Wand und kann nur noch an ihr entlang.',
    xsb: '########\n# $   .#\n#      #\n#  @   #\n########',
  },
  {
    title: 'Erst weg vom Ziel',
    moves: 16,
    pushes: 3,
    sol: 'uuurrDurrddlLdlU',
    idea: 'Manchmal muss eine Kiste erst vom Ziel weg, damit man sie von der richtigen Seite schieben kann.',
    intro: 'Das Ziel liegt direkt neben der Kiste. Von dieser Seite kommst du aber nicht heran.',
    xsb: '#######\n#     #\n# .$# #\n#     #\n#@    #\n#######',
  },
  {
    title: 'Nur eine auf einmal',
    moves: 20,
    pushes: 8,
    sol: 'urrDRRRllllddrUluRRR',
    idea: 'Zwei Kisten hintereinander lassen sich nicht schieben.',
    intro: 'Zwei Kisten hintereinander sind zu schwer. Schaff zuerst der einen Platz.',
    xsb: '#########\n#   #   #\n#   #   #\n#@ $$ ..#\n#   #   #\n#   #   #\n#########',
  },
  {
    title: 'Das hintere Ziel zuerst',
    moves: 16,
    pushes: 8,
    sol: 'dRDDDuurruLulDDD',
    idea: 'In einer Sackgasse kommt das hinterste Ziel zuerst an die Reihe.',
    intro: 'Der Gang unten ist eine Sackgasse. Füll ihn von hinten nach vorn.',
    xsb: '#######\n#     #\n# @   #\n#  $  #\n#  $  #\n### ###\n  #.#\n  #.#\n  ###',
  },
  {
    title: 'Zwei an der Wand',
    moves: 14,
    pushes: 8,
    sol: 'UUdRdrUUluRlLL',
    idea: 'Zwei Kisten nebeneinander an der Wand bewegen sich nicht mehr.',
    intro: 'Zwei Kisten, die nebeneinander an der Wand stehen, sitzen fest.',
    xsb: '########\n#.    .#\n#      #\n#  $$  #\n#  @   #\n########',
  },
  {
    title: 'Drei Kisten',
    moves: 20,
    pushes: 7,
    sol: 'uuulDDuulDDuullDDldR',
    idea: 'Drei Kisten, drei Ziele und eine Säule im Weg.',
    intro: 'Drei Kisten für drei Ziele. Die Säule steht im Weg.',
    xsb: '########\n#      #\n# $ $$ #\n#  #   #\n#  ...@#\n########',
  },
  {
    title: 'Der Tunnel',
    moves: 22,
    pushes: 11,
    sol: 'luRRRRRllluullDldRRRRR',
    idea: 'Durch einen schmalen Gang geht es nur geradeaus, eine Kiste nach der anderen.',
    intro: 'Im Tunnel geht es nur geradeaus. Denk an das hintere Ziel.',
    xsb: '##########\n#    #####\n# $  #####\n#  $   ..#\n#  @ #####\n#    #####\n##########',
  },
  {
    title: 'Durch die Tür und zurück',
    moves: 36,
    pushes: 15,
    sol: 'uurrRRurrdLLLLulDrrrddrUruLLLLdLUruL',
    idea: 'Die Kiste in der Tür lässt sich nur von drüben richtig schieben: erst hindurch, dann zurück.',
    intro: 'Die Kiste in der Tür musst du von der anderen Seite schieben.',
    xsb: '#########\n#.  #   #\n#   $   #\n#.  # $ #\n#@  #   #\n#########',
  },
  {
    title: 'Vier Wege',
    moves: 32,
    pushes: 14,
    sol: 'DulluuurrDDLdRRRuLLuulldDRdLrrUU',
    idea: 'Vier Kisten, vier Ziele, jede auf kurzem Weg, wenn die Reihenfolge stimmt.',
    intro: 'Vier Kisten. Jede hat einen kurzen Weg, wenn die Reihenfolge stimmt.',
    xsb: ' #######\n #  .  #\n## #$# ##\n#  $ $  #\n#.  @  .#\n## #$# ##\n #  .  #\n #######',
  },
  {
    title: 'Der Hof',
    moves: 39,
    pushes: 12,
    sol: 'uluuulDldRdrrrurruLulDDuLLDldRulluRurDD',
    idea: 'Drei Ziele in einer Reihe, und unter der mittleren Kiste steht eine Säule.',
    intro: 'Die mittlere Kiste kann nicht einfach geradeaus.',
    xsb: '#########\n#   #   #\n# $ $ $ #\n#   #   #\n## ... ##\n #  @  #\n #######',
  },
  {
    title: 'Meisterstück',
    moves: 83,
    pushes: 27,
    sol: 'rrdLulDDDlddrUluRddrrrruurruuulldLLLulDDDRRlllddrUluRuurrrrurrdLLLLLulDDDRllddrUluR',
    idea: 'Alles zusammen: vier Kisten auf zwei Ebenen des Lagers.',
    intro: 'Das Meisterstück. Nimm dir Zeit, „Zug zurück“ hilft immer.',
    xsb: ' #########\n #@  #   #\n # $ $ $ #\n## ## ## #\n#  ...   #\n#  #*#  ##\n#       #\n#########',
  },
];

export const LESSONS: readonly Lesson[] = DEFS.map((d, i) => ({ ...d, n: i + 1, id: `lektion-${i + 1}` }));
