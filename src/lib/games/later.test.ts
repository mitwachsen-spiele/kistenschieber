import { describe, expect, it, vi } from 'vitest';
import { later } from './later';

describe('Nachladen bei Bedarf', () => {
  it('holt erst beim ersten Wunsch, nur einmal; danach liefert es das Geladene, auch ohne Wunsch', async () => {
    const load = vi.fn(() => Promise.resolve('karte'));
    const get = later(load);
    expect([get(null), get(false), get(undefined)]).toEqual([undefined, undefined, undefined]);
    expect(load).not.toHaveBeenCalled();
    expect(get('eis')).toBeUndefined(); // kommt erst
    await Promise.resolve();
    expect([get(null), get('sand')]).toEqual(['karte', 'karte']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('scheitert es, bleibt es still und fragt nicht noch einmal', async () => {
    const load = vi.fn(() => Promise.reject(new Error('ohne Netz')));
    const get = later(load);
    get(true);
    await Promise.resolve();
    await Promise.resolve();
    expect([get(true), get(true)]).toEqual([undefined, undefined]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
