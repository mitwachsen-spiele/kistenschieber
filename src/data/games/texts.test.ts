import { describe, expect, it } from 'vitest';
import { LESSONS } from './lessons';
import {
  FINALE,
  LOCKED,
  badgeText,
  introPill,
  lockedGo,
  lockedWhy,
  thumbLabel,
  GAME_BUTTONS,
  SIGN,
  cardTag,
  continueText,
  countText,
  fieldLabel,
  isFinale,
  lessonName,
  nextText,
  sceneLabel,
  signText,
  startStatus,
  winText,
} from './texts';

const lesson = (n: number) => LESSONS[n - 1]!;

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
});

describe('Schild', () => {
  it('Intro ist der Text der Lektion', () => {
    for (const l of LESSONS) expect(signText('intro', l, 0)).toBe(l.intro);
  });

  it('jeder Schlüssel hat einen Text, wörtlich aus dem Entwurf', () => {
    const keys: (keyof typeof SIGN)[] = [
      'blocked',
      'stuck',
      'unsolvable',
      'placed',
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
    expect(SIGN.placed).toBe('Die Kiste steht.');
    expect(SIGN.shownWin).toBe('So geht es. Jetzt du? „Nochmal“ startet die Lektion neu.');
  });
});

describe('Zähler, Titel, Knöpfe', () => {
  it('Zähler: „0 Züge“, „1 Zug“, „N Züge“', () => {
    expect([countText(0), countText(1), countText(2)]).toEqual(['0 Züge', '1 Zug', '2 Züge']);
  });

  it('Name „Lektion N: Titel“', () => {
    expect(lessonName(lesson(1))).toBe('Lektion 1: Erster Schubs');
  });

  it('Beschriftung des Spielfelds wörtlich', () => {
    expect(fieldLabel(lesson(3))).toBe('Lektion 3: Zwei Kisten. Antippen, Wischen oder Pfeiltasten bewegen die Figur.');
  });

  it('nach dem Sieg weiter zur nächsten Lektion, nach Lektion 15 „Zur Levelwahl“', () => {
    expect(nextText(1)).toBe('Weiter zu Lektion 2');
    expect(nextText(14)).toBe('Weiter zu Lektion 15');
    expect(nextText(15)).toBe('Zur Levelwahl');
    expect([isFinale(14), isFinale(15)]).toEqual([false, true]);
    expect(GAME_BUTTONS).toMatchObject({ again: 'Nochmal', offer: 'Zu knifflig? Überspringen' });
  });
});

describe('Startbildschirm und Lektionskarten', () => {
  it('Zeile unter dem Titel: Lektionen gezählt, nach der Einführung kommen die Level bald', () => {
    expect(startStatus(0, 15, false)).toBe('Einführung: 0 von 15 Lektionen geschafft');
    expect(startStatus(4, 15, false)).toBe('Einführung: 4 von 15 Lektionen geschafft');
    expect(startStatus(12, 15, true)).toBe('Einführung geschafft. Die Level kommen bald.');
  });

  it('großer Knopf: „Spielen“ oder „Weiterspielen: Lektion N“', () => {
    expect(continueText(false, 1)).toBe('Spielen');
    expect(continueText(true, 2)).toBe('Weiterspielen: Lektion 2');
  });

  it('Bild der Lektion und Unterzeile der Karte', () => {
    expect(sceneLabel(lesson(1))).toBe('Lektion 1: Erster Schubs als Bild');
    expect(cardTag(1, 9)).toBe('1 Kiste, kürzester Weg 9 Züge');
    expect(cardTag(4, 83)).toBe('4 Kisten, kürzester Weg 83 Züge');
  });
});

describe('Levelwahl', () => {
  it('Pille: 15 Lektionen, danach abgeschlossen', () => {
    expect(introPill(15, false)).toBe('15 Lektionen');
    expect(introPill(15, true)).toBe('abgeschlossen');
  });

  it('Vorschau-Label', () => {
    expect(thumbLabel(7)).toBe('Vorschau von Lektion 7');
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
});
