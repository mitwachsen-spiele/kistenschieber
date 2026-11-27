import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenLock, type Sentinel, wantLock, watchWakeLock } from './wake-lock';

const flush = async () => {
  for (let i = 0; i < 3; i++) await Promise.resolve();
};

/** Eine Sperre, die mitzählt, wie oft sie freigegeben wurde, und ihr release-Ereignis auslösen kann */
function sentinel(log: string[]) {
  const listeners: (() => void)[] = [];
  const s: Sentinel & { fire(): void } = {
    release: () => {
      log.push('release');
      return Promise.resolve();
    },
    addEventListener: (_t, fn) => listeners.push(fn),
    fire: () => listeners.forEach((fn) => fn()),
  };
  return s;
}

function setup(opts: { reject?: boolean; visible?: boolean } = {}) {
  const log: string[] = [];
  const sentinels: ReturnType<typeof sentinel>[] = [];
  let visible = opts.visible ?? true;
  const lock = new ScreenLock({
    request: () => {
      log.push('request');
      if (opts.reject) return Promise.reject(new Error('abgelehnt'));
      const s = sentinel(log);
      sentinels.push(s);
      return Promise.resolve(s);
    },
    visible: () => visible,
  });
  return { lock, log, sentinels, setVisible: (v: boolean) => (visible = v) };
}

describe('wantLock', () => {
  it('nur auf dem Spielfeld und solange die Seite zu sehen ist', () => {
    expect(wantLock('spiel', true)).toBe(true);
    expect(wantLock('spiel', false)).toBe(false);
    for (const s of ['start', 'level', 'einstellungen', 'gesperrt', '']) expect(wantLock(s, true)).toBe(false);
  });
});

describe('ScreenLock', () => {
  it('fordert auf dem Spielfeld an, einmal, und gibt beim Verlassen frei', async () => {
    const { lock, log } = setup();
    lock.show('start');
    expect(log).toEqual([]);
    lock.show('spiel');
    lock.show('spiel'); // angefragt, noch nicht da: nicht noch einmal
    await flush();
    expect(lock.held).toBe(true);
    lock.show('spiel');
    expect(log).toEqual(['request']);
    lock.show('level');
    expect(lock.held).toBe(false);
    expect(log).toEqual(['request', 'release']);
  });

  it('versteckt: frei; wieder sichtbar: neu anfordern', async () => {
    const { lock, log, setVisible } = setup();
    lock.show('spiel');
    await flush();
    setVisible(false);
    lock.update();
    expect(lock.held).toBe(false);
    setVisible(true);
    lock.update();
    await flush();
    expect(log).toEqual(['request', 'release', 'request']);
    expect(lock.held).toBe(true);
  });

  it('gibt der Browser die Sperre selbst frei, wird sie beim nächsten Sichtbarwerden neu angefordert', async () => {
    const { lock, log, sentinels } = setup();
    lock.show('spiel');
    await flush();
    sentinels[0]!.fire();
    expect(lock.held).toBe(false);
    sentinels[0]!.fire(); // eine alte Sperre stört nicht
    lock.update();
    await flush();
    expect(log).toEqual(['request', 'request']);
    expect(lock.held).toBe(true);
  });

  it('kommt die Sperre erst nach dem Verlassen, wird sie gleich freigegeben', async () => {
    const { lock, log } = setup();
    lock.show('spiel');
    lock.show('start');
    await flush();
    expect(log).toEqual(['request', 'release']);
    expect(lock.held).toBe(false);
  });

  it('nicht sichtbar: nichts anfordern', () => {
    const { lock, log } = setup({ visible: false });
    lock.show('spiel');
    expect(log).toEqual([]);
  });

  it('Fehler bleiben still, später wird neu gefragt', async () => {
    const { lock, log } = setup({ reject: true });
    lock.show('spiel');
    await flush();
    expect(lock.held).toBe(false);
    lock.update();
    await flush();
    expect(log).toEqual(['request', 'request']);
  });

  it('scheitert die Freigabe, bleibt es still und die Sperre gilt als frei', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { lock, sentinels } = setup();
    lock.show('spiel');
    await flush();
    const s = sentinels[0]!;
    s.release = () => Promise.reject(new Error('schon frei'));
    lock.show('level');
    await flush();
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', unhandled);
    expect(lock.held).toBe(false);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('ohne Wake Lock im Browser: nichts', () => {
    const lock = new ScreenLock({ request: null, visible: () => true });
    expect(() => lock.show('spiel')).not.toThrow();
    expect(lock.held).toBe(false);
  });
});

describe('watchWakeLock', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('nimmt navigator.wakeLock, folgt visibilitychange und gibt frei, wenn das Signal endet', async () => {
    const log: string[] = [];
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('document', doc);
    vi.stubGlobal('navigator', {
      wakeLock: {
        request(type: string) {
          log.push(`request ${type}`);
          return Promise.resolve(sentinel(log));
        },
      },
    });
    const ac = new AbortController();
    const lock = watchWakeLock(ac.signal);
    lock.show('spiel');
    await flush();
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    ac.abort();
    expect(log).toEqual(['request screen', 'release', 'request screen', 'release']);
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(log).toHaveLength(4);
  });

  it('ohne navigator.wakeLock still', () => {
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    vi.stubGlobal('navigator', {});
    const lock = watchWakeLock(new AbortController().signal);
    expect(() => lock.show('spiel')).not.toThrow();
    expect(lock.held).toBe(false);
  });
});
