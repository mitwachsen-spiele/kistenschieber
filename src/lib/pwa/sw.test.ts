import { describe, expect, it } from 'vitest';
import { cacheKey, olderKey, serviceWorkerSource, staleCaches } from './sw';

const ORIGIN = 'https://www.example.de';
const FILES = ['/_astro/game.js', '/_astro/three.js', '/manifest.webmanifest', '/spielen/'];

describe('Service Worker: Entscheidungen', () => {
  it('bedient nur GET auf der eigenen Seite und nur Dateien der Liste', () => {
    const key = (url: string, method = 'GET') => cacheKey(url, method, ORIGIN, FILES, '/spielen/');
    expect(key(`${ORIGIN}/_astro/three.js`)).toBe('/_astro/three.js');
    expect(key(`${ORIGIN}/spielen/`)).toBe('/spielen/');
    expect(key(`${ORIGIN}/spielen/?welt=1`)).toBe('/spielen/');
    expect(key(`${ORIGIN}/spielen/index.html`)).toBe('/spielen/');
    expect(key(`${ORIGIN}/_astro/game.js`, 'POST')).toBeNull();
    expect(key('https://cdn.example.com/_astro/game.js')).toBeNull();
    expect(key(`${ORIGIN}/`)).toBeNull();
    expect(key(`${ORIGIN}/spielen/anderes`)).toBeNull();
    expect(key('kaputt')).toBeNull();
  });

  it('räumt nur eigene alte Caches weg', () => {
    const keys = ['mitwachsen-a', 'mitwachsen-b', 'fremd'];
    expect(staleCaches(keys, 'mitwachsen-', 'mitwachsen-b', [], null)).toEqual(['mitwachsen-a']);
  });

  it('räumt nicht, solange außer der sich meldenden Seite noch eine Spielseite offen ist', () => {
    const keys = ['mitwachsen-a', 'mitwachsen-b'];
    expect(staleCaches(keys, 'mitwachsen-', 'mitwachsen-b', ['tab1'], 'tab1')).toEqual(['mitwachsen-a']);
    expect(staleCaches(keys, 'mitwachsen-', 'mitwachsen-b', ['tab1', 'tab2'], 'tab1')).toEqual([]);
    expect(staleCaches(keys, 'mitwachsen-', 'mitwachsen-b', ['tab1'], null)).toEqual([]);
  });

  it('sucht in älteren Caches nur GET auf der eigenen Seite', () => {
    expect(olderKey(`${ORIGIN}/_astro/alt.js?x=1`, 'GET', ORIGIN)).toBe('/_astro/alt.js');
    expect(olderKey(`${ORIGIN}/_astro/alt.js`, 'POST', ORIGIN)).toBeNull();
    expect(olderKey('https://cdn.example.com/x.js', 'GET', ORIGIN)).toBeNull();
    expect(olderKey('kaputt', 'GET', ORIGIN)).toBeNull();
  });
});

type Handler = (event: Record<string, unknown>) => void;
type Files = Map<string, string>;
/** Geteilte Umgebung: Caches und offene Seiten (Kennung und Adresse) */
type Env = { store: Map<string, Files>; windows: { id: string; url: string }[] };

/** Führt den erzeugten Service Worker in einer kleinen Nachbildung der Browser-Umgebung aus */
function runServiceWorker(version: string, env: Env, files = FILES) {
  const { store } = env;
  const handlers = new Map<string, Handler>();
  const log: string[] = [];
  const registration = { waiting: null as unknown, installing: null as unknown };
  const self = {
    location: { origin: ORIGIN },
    registration,
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
    skipWaiting: () => (log.push('skipWaiting'), Promise.resolve()),
    clients: {
      claim: () => (log.push('claim'), Promise.resolve()),
      matchAll: (opts: { type: string; includeUncontrolled: boolean }) =>
        Promise.resolve(opts.type === 'window' && opts.includeUncontrolled ? env.windows : []),
    },
  };
  const cacheOf = (name: string) => {
    const entries = store.get(name) ?? new Map<string, string>();
    store.set(name, entries);
    return {
      addAll: (reqs: { url: string; cache: string }[]) => {
        for (const r of reqs) {
          log.push(`lade ${r.url} (${r.cache})`);
          entries.set(r.url, `${version}:${r.url}`);
        }
        return Promise.resolve();
      },
      match: (key: string) => Promise.resolve(entries.get(key)),
    };
  };
  const caches = {
    open: (name: string) => Promise.resolve(cacheOf(name)),
    keys: () => Promise.resolve([...store.keys()]),
    delete: (name: string) => Promise.resolve(store.delete(name)),
  };
  const fetch = (req: { url: string }) => Promise.resolve(`netz:${req.url}`);
  class Request {
    constructor(
      readonly url: string,
      readonly init: { cache: string },
    ) {}
    get cache() {
      return this.init.cache;
    }
  }
  const source = serviceWorkerSource({ version, files, scope: '/spielen/', prefix: 'mitwachsen-' });
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function('self', 'caches', 'fetch', 'Request', 'URL', source) as (...env: unknown[]) => void;
  run(self, caches, fetch, Request, URL);

  const waitUntil = async (type: string, event: Record<string, unknown> = {}) => {
    let done: Promise<unknown> = Promise.resolve();
    handlers.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  const request = async (url: string, method = 'GET') => {
    const answer: { p: Promise<unknown> | null } = { p: null };
    handlers.get('fetch')!({ request: { url, method }, respondWith: (p: Promise<unknown>) => (answer.p = p) });
    return answer.p === null ? 'durchgereicht' : await answer.p;
  };
  const message = (data: unknown, from: string | null) =>
    waitUntil('message', { data, source: from === null ? null : { id: from } });
  return {
    install: () => waitUntil('install'),
    activate: () => waitUntil('activate'),
    message,
    request,
    log,
    registration,
  };
}

const page = (id: string) => ({ id, url: `${ORIGIN}/spielen/` });

describe('Service Worker: Ablauf', () => {
  it('speichert beim Installieren alles am HTTP-Cache vorbei und antwortet danach aus dem Cache', async () => {
    const store = new Map<string, Files>();
    const sw = runServiceWorker('v1', { store, windows: [] });
    await sw.install();
    expect(sw.log).toContain('lade /_astro/three.js (reload)');
    expect([...store.keys()]).toEqual(['mitwachsen-v1']);
    await sw.activate();
    expect(sw.log).toContain('claim');
    expect(await sw.request(`${ORIGIN}/spielen/`)).toBe('v1:/spielen/');
    expect(await sw.request(`${ORIGIN}/_astro/three.js`)).toBe('v1:/_astro/three.js');
    expect(await sw.request(`${ORIGIN}/_astro/game.js`, 'POST')).toBe('durchgereicht');
    expect(await sw.request('https://cdn.example.com/x.js')).toBe('durchgereicht');
    store.get('mitwachsen-v1')!.delete('/_astro/game.js');
    expect(await sw.request(`${ORIGIN}/_astro/game.js`)).toBe(`netz:${ORIGIN}/_astro/game.js`);
  });

  it('eine neue Version lässt die alte stehen, bis sie aktiv wird, und räumt erst dann auf', async () => {
    const store = new Map<string, Files>([['fremd', new Map()]]);
    const env: Env = { store, windows: [] };
    const old = runServiceWorker('v1', env);
    await old.install();
    await old.activate();
    const next = runServiceWorker('v2', env);
    await next.install();
    // Die alte Seite läuft noch und holt Three.js erst jetzt: Es kommt aus ihrem Cache
    expect([...store.keys()].sort()).toEqual(['fremd', 'mitwachsen-v1', 'mitwachsen-v2']);
    expect(await old.request(`${ORIGIN}/_astro/three.js`)).toBe('v1:/_astro/three.js');
    await next.activate();
    expect([...store.keys()].sort()).toEqual(['fremd', 'mitwachsen-v2']);
    expect(await next.request(`${ORIGIN}/spielen/`)).toBe('v2:/spielen/');
  });

  it('wartet von sich aus auf das Ende der alten Seiten und wird nur auf Bitte des Spiels sofort aktiv', async () => {
    const sw = runServiceWorker('v1', { store: new Map(), windows: [] });
    await sw.install();
    expect(sw.log).not.toContain('skipWaiting');
    await sw.message({ type: 'etwas anderes' }, 'tab1');
    await sw.message(null, 'tab1');
    expect(sw.log).not.toContain('skipWaiting');
    await sw.message({ type: 'skip-waiting' }, 'tab1');
    expect(sw.log).toContain('skipWaiting');
  });
});

describe('Service Worker: Übernehmen an einer sicheren Stelle', () => {
  // Version 2 hat ein neues Three.js; die alte Seite kennt nur das alte
  const NEXT = ['/_astro/game.js', '/_astro/three-2.js', '/manifest.webmanifest', '/spielen/'];

  async function updateWhileOpen(windows: { id: string; url: string }[]) {
    const store = new Map<string, Files>();
    const env: Env = { store, windows };
    const old = runServiceWorker('v1', env);
    await old.install();
    await old.activate();
    const next = runServiceWorker('v2', env, NEXT);
    await next.install();
    await next.message({ type: 'skip-waiting' }, 'tab1'); // das Spiel in tab1 schläft und lädt gleich neu
    await next.activate();
    return { store, env, next };
  }

  it('die bittende Seite behält ihren alten Cache, bis sie neu geladen hat und sich meldet', async () => {
    const { store, env, next } = await updateWhileOpen([page('tab1'), { id: 'start', url: `${ORIGIN}/` }]);
    // Hat das Kind die Figur zwischen Bitte und Übernahme geweckt, spielt tab1 noch mit der alten Fassung weiter
    expect([...store.keys()].sort()).toEqual(['mitwachsen-v1', 'mitwachsen-v2']);
    expect(await next.request(`${ORIGIN}/_astro/three.js`)).toBe('v1:/_astro/three.js');
    // Neu geladen (neue Kennung), meldet sich: Jetzt geht der alte Cache
    env.windows = [page('tab1-neu'), { id: 'start', url: `${ORIGIN}/` }];
    await next.message({ type: 'tidy' }, 'tab1-neu');
    expect([...store.keys()]).toEqual(['mitwachsen-v2']);
  });

  it('ein zweiter alter Tab bekommt sein spät geladenes Three.js weiter aus dem alten Cache', async () => {
    const { store, env, next } = await updateWhileOpen([page('tab1'), page('tab2')]);
    expect([...store.keys()].sort()).toEqual(['mitwachsen-v1', 'mitwachsen-v2']);
    // Der alte Tab hängt jetzt am neuen Service Worker; die Datei gibt es nur noch im alten Cache
    expect(await next.request(`${ORIGIN}/_astro/three.js`)).toBe('v1:/_astro/three.js');
    expect(await next.request(`${ORIGIN}/_astro/unbekannt.js`)).toBe(`netz:${ORIGIN}/_astro/unbekannt.js`);
    expect(await next.request(`${ORIGIN}/_astro/three.js`, 'POST')).toBe('durchgereicht');
    expect(await next.request('https://cdn.example.com/x.js')).toBe('durchgereicht');
    // Der alte Tab ist zu, die neue Seite meldet sich: Jetzt ist aufgeräumt
    env.windows = [page('tab3')];
    await next.message({ type: 'tidy' }, 'tab3');
    expect([...store.keys()]).toEqual(['mitwachsen-v2']);
  });

  it('„tidy“ räumt nicht, solange eine andere Spielseite offen ist oder schon eine neuere Version wartet', async () => {
    const { store, env, next } = await updateWhileOpen([page('tab1'), page('tab2')]);
    env.windows = [page('tab2'), page('tab3')];
    await next.message({ type: 'tidy' }, 'tab3');
    expect(store.has('mitwachsen-v1')).toBe(true);
    env.windows = [page('tab3')];
    next.registration.waiting = {};
    await next.message({ type: 'tidy' }, 'tab3');
    expect(store.has('mitwachsen-v1')).toBe(true);
    next.registration.waiting = null;
    await next.message({ type: 'tidy' }, null);
    expect(store.has('mitwachsen-v1')).toBe(true);
  });
});
