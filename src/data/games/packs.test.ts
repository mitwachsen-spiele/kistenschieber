import { describe, expect, it } from 'vitest';
import { COUNTS, PUZZLES, WORD } from './packs';

describe('Pakete', () => {
  it('Einführung mit 15 Lektionen, dazu 6 Level', () => {
    expect(COUNTS).toEqual({ e: 15, l: 6 });
    expect(PUZZLES.e.map((p) => p.id).slice(0, 2)).toEqual(['lektion-1', 'lektion-2']);
    expect(PUZZLES.l.map((p) => p.id).slice(0, 2)).toEqual(['level-1', 'level-2']);
    expect(WORD).toEqual({ e: 'Lektion', l: 'Level' });
  });
});
