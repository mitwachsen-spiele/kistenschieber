// Welche Töne ein Zustandswechsel des Spiels auslöst, rein und getestet; gespielt werden sie in sfx.ts (WebAudio).
// Ein Schritt tickt ganz leise, aber höchstens alle STEP_GAP ms (ein langer Laufweg wird kein Maschinengewehr). Ein
// Schub poltert kurz und hölzern; landet die Kiste auf einem Ziel, rastet sie mit Klick und kleinem Glockenton ein, wenn
// der Schub zu Ende ist. „Geschafft!“ spielt eine kurze Melodie. Beim Vorspielen der Lösung bleibt es ruhig: nur Einrasten
// und Melodie. Zug zurück, Neustart, Nochmal, Anstoßen und Tipp sind still.
import type { Game } from '../../lib/games/sokoban/state';

export type SoundId = 'step' | 'push' | 'lock' | 'win';

/** Welle eines Tons; `noise` ist Rauschen durch einen Bandpass um die Frequenz */
export type Wave = 'sine' | 'triangle' | 'noise';

/** Ein Ton: Hz, Länge (s), Welle, Lautstärke, Gleiten (Faktor der Frequenz bis zum Ende), Beginn (s) */
export type Note = readonly [freq: number, len: number, wave: Wave, gain: number, slide: number, at: number];

/** Höchstens so viele Töne klingen zugleich (sfx.ts) */
export const MAX_VOICES = 6;
/** Mindestabstand zweier Schritt-Töne in ms */
export const STEP_GAP = 200;
/** So lange nach dem Einrasten beginnt die Melodie von „Geschafft!“ (s) */
export const WIN_AFTER = 0.12;

/** Die Töne: kurz, warm und leise */
export const SOUNDS: Record<SoundId, readonly Note[]> = {
  // ein weiches Tappen, sinkt leicht
  step: [[190, 0.045, 'sine', 0.035, 0.85, 0]],
  // hölzerner Rumms (tief, fällt) und kurzes Schaben (Rauschen um 600 Hz)
  push: [
    [140, 0.11, 'triangle', 0.12, 0.7, 0],
    [600, 0.12, 'noise', 0.05, 1, 0],
  ],
  // heller Klick, dann ein kleiner Glockenton (C6 mit G6 darüber)
  lock: [
    [1400, 0.03, 'triangle', 0.07, 0.5, 0],
    [1046.5, 0.22, 'sine', 0.07, 1, 0.03],
    [1567.98, 0.28, 'sine', 0.035, 1, 0.07],
  ],
  // C5 E5 G5 C6 hinauf, der letzte klingt nach
  win: [
    [523.25, 0.16, 'triangle', 0.08, 1, 0],
    [659.25, 0.16, 'triangle', 0.08, 1, 0.1],
    [783.99, 0.16, 'triangle', 0.08, 1, 0.2],
    [1046.5, 0.45, 'triangle', 0.08, 1, 0.3],
  ],
};

/** Ein Ton, der erklingen soll: welcher, und wie viele Sekunden ab jetzt */
export interface Cue {
  readonly sound: SoundId;
  readonly at: number;
}

/**
 * Töne zum Wechsel von `prev` zu `next`. `lastStep` ist der Beginn (ms, Zeit des Spiels) des letzten Schritts mit Ton;
 * zurück kommt er neu, wenn ein Schritt tickt
 */
export function cues(prev: Game, next: Game, lastStep: number): { readonly cues: Cue[]; readonly lastStep: number } {
  const out: Cue[] = [];
  let last = lastStep;
  const a = next.a;
  // Ein neuer Schritt beginnt: Jeder bekommt eine neue laufende Nummer (Zug zurück und Neustart setzen keinen)
  if (a && a.n !== prev.a?.n) {
    if (a.kind === 'walk' && !next.auto && a.t0 - lastStep >= STEP_GAP) {
      out.push({ sound: 'step', at: 0 });
      last = a.t0;
    } else if (a.kind === 'push') {
      if (!next.auto) out.push({ sound: 'push', at: 0 });
      // Einrasten, wenn die Kiste ankommt
      if (next.L.goals.has(a.bto)) out.push({ sound: 'lock', at: a.dur / 1000 });
    }
  }
  // Sieg nur aus einem fertigen Schub, nicht aus „Zug zurück“ auf einen alten Sieg
  if (next.won && !prev.won && prev.a?.kind === 'push') out.push({ sound: 'win', at: WIN_AFTER });
  return { cues: out, lastStep: last };
}
