import { describe, expect, it } from 'vitest';
import { LESSONS } from './lessons';
import { LEVELS } from './levels';
import {
  FINALE,
  LOCKED,
  badgeText,
  INTRO,
  introPill,
  introSub,
  startPill,
  lockedGo,
  lockedWhy,
  thumbLabel,
  GAME_BUTTONS,
  MENU,
  PAD,
  SIGN,
  cardTag,
  continueText,
  countText,
  fieldLabel,
  isFinale,
  LEVEL_PART,
  LOCKED_LEVEL,
  SHOWN_WIN_LEVEL,
  dayText,
  lessonName,
  levelGo,
  levelStatus,
  lockedDay,
  menuNote,
  menuSkip,
  nextText,
  puzzleName,
  sceneLabel,
  signText,
  startStatus,
  winText,
} from './texts';

const lesson = (n: number) => LESSONS[n - 1]!;
const level = (n: number) => LEVELS[n - 1]!;

describe('Sieg-Text', () => {
  it('bis zum Optimum „kürzer geht es nicht“', () => {
    expect(winText(9, 9, false)).toBe('Geschafft! 9 Züge, kürzer geht es nicht.');
    expect(winText(8, 9, false)).toBe('Geschafft! 8 Züge, kürzer geht es nicht.');
  });

  it('darüber mit dem Optimum', () => {
    expect(winText(12, 9, false)).toBe('Geschafft! 12 Züge, am kürzesten wären 9.');
  });

  it('Lektion 15 hängt „Damit ist die Einführung geschafft.“ an, die anderen nicht', () => {
    const last = lesson(15);
    expect(signText('win', last, last.moves)).toBe(
      `Geschafft! ${last.moves} Züge, kürzer geht es nicht. Damit ist die Einführung geschafft.`,
    );
    expect(signText('win', last, 90)).toBe(
      `Geschafft! 90 Züge, am kürzesten wären ${last.moves}. Damit ist die Einführung geschafft.`,
    );
    expect(FINALE).toBe(' Damit ist die Einführung geschafft.');
    expect(signText('win', lesson(14), 999)).not.toContain('Einführung');
  });

  it('Level hängen nichts an, auch Level 6 nicht', () => {
    expect(signText('win', level(6), 31, 'l')).toBe('Geschafft! 31 Züge, kürzer geht es nicht.');
    expect(signText('win', { n: 15, moves: 9 }, 9, 'l')).not.toContain('Einführung');
  });
});

describe('Schild', () => {
  it('ohne Meldung bleibt das Schild leer, auch zu Beginn jeder Lektion (keine Lektionshinweise)', () => {
    for (const l of LESSONS) expect(signText(null, l, 0)).toBe('');
  });

  it('jeder Schlüssel hat einen Text, wörtlich aus dem Entwurf', () => {
    const keys: (keyof typeof SIGN)[] = [
      'blocked',
      'stuck',
      'unsolvable',
      'atStart',
      'restarted',
      'tipDead',
      'tipHard',
      'tip',
      'noOptions',
      'showing',
      'shownWin',
    ];
    for (const k of keys) expect(signText(k, lesson(1), 0)).toBe(SIGN[k]);
    expect(SIGN.atStart).toBe('Ganz am Anfang, weiter zurück geht es nicht.');
    expect(SIGN.unsolvable).toBe('So geht es nicht mehr auf. Mit „Zug zurück“ ein paar Schritte zurück.');
    expect(SIGN.stuck).toBe('Diese Kiste kommt hier nicht mehr weg. Mit „Zug zurück“ geht es weiter.');
    expect(Object.values(SIGN)).not.toContain('Die Kiste steht.');
    expect(SIGN.tip).toBe('Tipp: Diese Kiste in Pfeilrichtung schieben.');
    expect(SIGN.shownWin).toBe('So geht es. Jetzt du? „Nochmal“ startet die Lektion neu.');
    expect(signText('shownWin', level(1), 0, 'l')).toBe(SHOWN_WIN_LEVEL);
    expect(SHOWN_WIN_LEVEL).toBe('So geht es. Jetzt du? „Nochmal“ startet das Level neu.');
    expect(signText('tip', level(1), 0, 'l')).toBe(SIGN.tip);
  });
});

describe('Zähler, Titel, Knöpfe', () => {
  it('Zähler: „0 Züge“, „1 Zug“, „N Züge“', () => {
    expect([countText(0), countText(1), countText(2)]).toEqual(['0 Züge', '1 Zug', '2 Züge']);
  });

  it('Name „Lektion N: Titel“ und „Level N: Titel“', () => {
    expect(lessonName(lesson(1))).toBe('Lektion 1: Erster Schubs');
    expect(puzzleName('l', level(2))).toBe('Level 2: Poller');
  });

  it('Beschriftung des Spielfelds wörtlich', () => {
    expect(fieldLabel(lesson(3))).toBe('Lektion 3: Zwei Kisten. Antippen oder Pfeiltasten bewegen die Figur.');
    expect(fieldLabel(level(1), 'l')).toBe('Level 1: Anleger. Antippen oder Pfeiltasten bewegen die Figur.');
  });

  it('nach dem Sieg „Weiter zu …“ (auch nach Lektion 15 zu Level 1), sonst „Zur Levelwahl“ wie im Entwurf', () => {
    expect(nextText('#lektion-2')).toBe('Weiter zu Lektion 2');
    expect(nextText('#lektion-15')).toBe('Weiter zu Lektion 15');
    expect(nextText('#level-1')).toBe('Weiter zu Level 1');
    expect(nextText('#level')).toBe('Zur Levelwahl');
    expect([isFinale(14), isFinale(15)]).toEqual([false, true]);
    expect(GAME_BUTTONS).toMatchObject({ again: 'Nochmal', offer: 'Zu knifflig? Überspringen' });
    // Tipp gibt es nur noch im Menü und mit H: unten bleibt nur „Zug zurück“ (Platz auf dem Handy)
    expect(Object.keys(GAME_BUTTONS)).toEqual(['menu', 'again', 'offer', 'undo']);
  });
});

describe('Startbildschirm und Lektionskarten', () => {
  it('Teil „Einführung“: Titel, Unterzeile, Pille „jetzt spielbar“ bzw. Haken mit Text', () => {
    expect(INTRO.title).toBe('Einführung');
    expect(introSub(15)).toBe('Lernen in 15 Lektionen');
    expect(startPill(false)).toBe('jetzt spielbar');
    expect(startPill(true)).toBe('✓ geschafft');
  });

  it('Fortschritt: Lektionen gezählt, geschafft (auch mit Lösung gesehen) als erledigt', () => {
    expect(startStatus(0, 15, false)).toBe('0 von 15 Lektionen geschafft');
    expect(startStatus(4, 15, false)).toBe('4 von 15 Lektionen geschafft');
    expect(startStatus(12, 15, true)).toBe('Alle 15 Lektionen erledigt.');
    expect(startStatus(14, 15, false, 1)).toBe('14 von 15 Lektionen geschafft, 1 übersprungen');
    expect(startStatus(0, 15, false, 15)).toBe('0 von 15 Lektionen geschafft, 15 übersprungen');
    expect(startStatus(12, 15, true, 0)).toBe('Alle 15 Lektionen erledigt.');
  });

  it('großer Knopf: „Spielen“, „Weiterspielen: Lektion N“, geschafft „Einführung wiederholen“', () => {
    expect(continueText(false, 1)).toBe('Spielen');
    expect(continueText(true, 2)).toBe('Weiterspielen: Lektion 2');
    expect(continueText(true, 15, true)).toBe('Einführung wiederholen');
  });

  it('Bild der Lektion und Unterzeile der Karte', () => {
    expect(sceneLabel(lesson(1))).toBe('Lektion 1: Erster Schubs als Bild');
    expect(cardTag(1, 9)).toBe('1 Kiste, kürzester Weg 9 Züge');
    expect(cardTag(4, 83)).toBe('4 Kisten, kürzester Weg 83 Züge');
  });
});

describe('Levelwahl', () => {
  it('Pille: 15 Lektionen, geschafft derselbe Haken wie auf dem Startbildschirm', () => {
    expect(introPill(15, false)).toBe('15 Lektionen');
    expect(introPill(15, true)).toBe('✓ geschafft');
    expect(introPill(15, true)).toBe(startPill(true));
  });

  it('Vorschau-Label', () => {
    expect(thumbLabel(7)).toBe('Vorschau von Lektion 7');
    expect(thumbLabel(3, 'l')).toBe('Vorschau von Level 3');
  });

  it('ein Level vor seinem Tag sagt, wann es aufgeht', () => {
    expect(badgeText('locked', null, '2026-12-03')).toBe('Geht am 3. Dezember auf');
    expect(badgeText('locked', null, null)).toBe('Noch zu');
    expect(dayText('2026-12-01')).toBe('1. Dezember');
    expect(dayText('2027-01-06')).toBe('6. Januar');
  });

  it('Zeile je Zustand wörtlich, offen ohne', () => {
    expect(badgeText('locked', null)).toBe('Noch zu');
    expect(badgeText('done', { moves: 9 })).toBe('Geschafft, Bestwert 9 Züge');
    expect(badgeText('done', null)).toBeNull();
    expect(badgeText('shown', null)).toBe('Mit Lösung gesehen');
    expect(badgeText('skipped', null)).toBe('Übersprungen, später nachholen');
    expect(badgeText('open', null)).toBeNull();
  });

  it('gesperrte Lektion: Überschrift, Grund, Knopf und Hinweis wörtlich', () => {
    expect(LOCKED.title).toBe('Diese Lektion ist noch zu');
    expect(LOCKED.state).toBe('noch zu');
    expect(LOCKED.note).toBe('Alles wird der Reihe nach frei.');
    expect(lockedWhy(lesson(2))).toBe('Schaff zuerst Lektion 2: Um die Ecke oder überspring es; dann geht es weiter.');
    expect(lockedGo(2)).toBe('Zu Lektion 2');
  });

  it('gesperrtes Level: Überschrift wie im Entwurf, Grund mit Tag oder vorigem Level, Knopf', () => {
    expect(LOCKED_LEVEL.title).toBe('Dieses Level ist noch zu');
    expect(LOCKED_LEVEL.note).toBe('Jeden Tag im Advent geht ein neues Level auf. Gespielt wird der Reihe nach.');
    expect(lockedDay(level(3), level(3).opens)).toBe('Level 3: Laufsteg geht am 3. Dezember auf.');
    expect(lockedWhy(level(2), 'l')).toBe('Schaff zuerst Level 2: Poller oder überspring es; dann geht es weiter.');
    expect(lockedGo(2, 'l')).toBe('Zu Level 2');
  });
});

describe('Startbildschirm: Level als Adventskalender', () => {
  const span = { first: '2026-12-01', last: '2026-12-06' };

  it('vor dem ersten Tag: Pille „ab 1. Dezember“ und wann sie aufgehen', () => {
    expect(LEVEL_PART).toEqual({ title: 'Level', soon: 'ab 1. Dezember', now: 'Adventskalender' });
    expect(levelStatus(0, 0, span, { n: 1, opens: '2026-12-01' })).toBe(
      'Vom 1. Dezember bis 6. Dezember geht jeden Tag ein neues Level auf.',
    );
  });

  it('danach: geschafft von aufgegangen und wann das nächste kommt, am Ende „Weitere Level folgen.“', () => {
    expect(levelStatus(0, 1, span, { n: 2, opens: '2026-12-02' })).toBe(
      '0 von 1 Level geschafft. Level\u00a02 geht am 2.\u00a0Dezember auf.',
    );
    expect(levelStatus(2, 3, span, { n: 4, opens: '2026-12-04' })).toBe(
      '2 von 3 Leveln geschafft. Level\u00a04 geht am 4.\u00a0Dezember auf.',
    );
    expect(levelStatus(6, 6, span, null)).toBe('6 von 6 Leveln geschafft. Weitere Level folgen.');
  });

  it('Knopf: „Level N spielen“, angefangen „Weiterspielen: Level N“', () => {
    expect(levelGo(false, 1)).toBe('Level 1 spielen');
    expect(levelGo(true, 3)).toBe('Weiterspielen: Level 3');
  });
});

describe('Menü und Steuerkreuz', () => {
  it('Menü-Einträge und Notiz wörtlich aus dem Entwurf, in seiner Reihenfolge', () => {
    expect(Object.values(MENU)).toEqual([
      'Weiterspielen',
      'Neu starten',
      'Tipp',
      'Lösung zeigen',
      'Level wählen',
      'Einstellungen',
      'Startbildschirm',
    ]);
    expect([menuSkip('e'), menuSkip('l')]).toEqual(['Lektion überspringen', 'Level überspringen']);
    expect(menuNote('e')).toBe(
      'Überspringen und „Lösung zeigen“ machen die nächste Lektion frei. Zurückkommen geht jederzeit über „Level wählen“.',
    );
    expect(menuNote('l')).toBe(
      'Überspringen und „Lösung zeigen“ machen das nächste Level frei. Zurückkommen geht jederzeit über „Level wählen“.',
    );
  });

  it('Steuerkreuz: Gruppe „Laufen“, Knöpfe Hoch, Links, Rechts, Runter', () => {
    expect(PAD).toEqual({ group: 'Laufen', up: 'Hoch', left: 'Links', right: 'Rechts', down: 'Runter' });
  });
});
