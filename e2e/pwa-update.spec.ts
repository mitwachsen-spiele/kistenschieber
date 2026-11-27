// App-Updates mit zwei echten Fassungen der Seite: Fassung 1 ist der Build (dist/), Fassung 2 leitet e2e/versions.ts
// daraus ab (der nachgeladene Teil ks-menu unter neuem Namen, neuer Service Worker). Mit dem Cookie `ks-version=2` geht
// für einen Browser-Kontext Fassung 2 „live“ (e2e/serve.ts). Spec: docs/specs/kistenschieber.md („App“).
// Sichere Momente (src/scripts/games/pwa-update.ts): Startbildschirm, Levelwahl, Einstellungen und „Geschafft!“, nie
// mitten in einer Lektion. Projekt `pwa-update`, ein Test nach dem anderen.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseServiceWorker } from '../scripts/pwa.ts';
import { LESSONS } from '../src/data/games/lessons.ts';
import { SAFE_EVENT, WIN_MS } from '../src/scripts/games/pwa-moment.ts';
import { extras, openGame, playLurd, reloadGame, render, settled, stored, watchErrors } from './helpers.ts';
import { CHUNK, VERSIONS } from './versions-dirs.ts';

// Diese Tests warten echte Abläufe ab (Laden zweier Fassungen, Installation, Neuladen, teils zwei Tabs, nach
// „Geschafft!“ WIN_MS echter Uhr). Die Grenze gilt nur gegen Hänger
test.describe.configure({ timeout: 60_000 });

/** Cache-Name und nachgeladener Teil ks-menu (Pfad, Größe) einer Fassung, aus ihrem Service Worker gelesen */
function version(n: '1' | '2') {
  const dir = VERSIONS[n]!;
  const sw = parseServiceWorker(readFileSync(join(dir, 'sw.js'), 'utf8'));
  const chunk = sw?.files.find((f) => CHUNK.test(f));
  if (!sw || !chunk) throw new Error(`Fassung ${n}: Service Worker ohne ks-menu`);
  return { cache: sw.cache, chunk, chunkBytes: statSync(join(dir, chunk)).size };
}

/** Was `probe` in der Seite mitschreibt */
type Probe = { ksAsked: number; ksChanged: boolean; ksLeaving: boolean };

/**
 * Vor dem ersten Skript der Seite: zählt beendete Fragen nach einer neuen Version (`update()`, jeder Auslöser in
 * pwa-register.ts fragt), merkt einen Wechsel des Service Workers (vor dem Spiel angemeldet, also vor dessen Entscheidung)
 * und ob die Seite geht (`beforeunload` kommt noch im Aufruf von `location.reload()`). So prüfen die Tests „lädt nicht neu“
 * an dem Punkt, an dem die Seite entschieden hat, statt eine Weile zu warten
 */
function probe() {
  const w = window as unknown as Probe;
  Object.assign(w, { ksAsked: 0, ksChanged: false, ksLeaving: false });
  const proto = ServiceWorkerRegistration.prototype;
  const update = Object.getOwnPropertyDescriptor(proto, 'update')!.value as (
    this: ServiceWorkerRegistration,
  ) => Promise<unknown>;
  proto.update = function (this: ServiceWorkerRegistration) {
    const asked = update.call(this);
    const done = () => void w.ksAsked++;
    asked.then(done, done);
    return asked;
  } as ServiceWorkerRegistration['update'];
  navigator.serviceWorker.addEventListener('controllerchange', () => (w.ksChanged = true));
  addEventListener('beforeunload', () => (w.ksLeaving = true));
}
const asked = (page: Page) => page.evaluate(() => (window as unknown as Probe).ksAsked);
/** Dieselbe Seite wie beim Merken (`mark`), und sie ist nicht im Gehen */
const mark = (page: Page) => page.evaluate(() => ((window as unknown as { ksSame: boolean }).ksSame = true));
const stays = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Probe & { ksSame?: boolean };
    return w.ksSame === true && !w.ksLeaving;
  });

/**
 * Spiel öffnen (mit Hash, Test-Uhr), bis es steht, und warten, bis der Service Worker die Seite steuert. Zählt danach,
 * wie oft die Seite neu lädt
 */
async function openApp(page: Page, hash = '') {
  await page.addInitScript(probe);
  await openGame(page, { hash });
  await mark(page);
  // Angemeldet wird erst nach dem Laden; auf langsamen Runnern dauert das
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), { timeout: 30_000 })
    .toMatch(/\/sw\.js$/);
  let loads = 0;
  page.on('load', () => loads++);
  return () => loads;
}

/** Fassung 2 geht für diesen Browser-Kontext live */
const goLive = (context: BrowserContext) =>
  context.addCookies([{ name: 'ks-version', value: '2', url: 'http://localhost:4321' }]);
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());
const registration = (page: Page) =>
  page.evaluate(() =>
    navigator.serviceWorker.getRegistration('/').then((r) => ({
      waiting: r?.waiting?.state ?? null,
      active: r?.active?.state ?? null,
    })),
  );
const WAITING = { waiting: 'installed', active: 'activated' };
const ACTIVE = { waiting: null, active: 'activated' };
/** Wie der Browser von sich aus: nach einer neuen Version fragen */
const askForUpdate = (page: Page) =>
  page.evaluate(() => navigator.serviceWorker.getRegistration('/').then((r) => r?.update().then(() => undefined)));
/** Größe einer Datei, wie die Seite sie bekommt (über den Service Worker), sonst minus Status */
const fetchBytes = (page: Page, url: string) =>
  page.evaluate(
    (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.arrayBuffer().then((b) => b.byteLength) : -r.status)),
    url,
  );
/** Bildschirm wechseln wie über einen Link (Hash), bis er steht */
async function go(page: Page, hash: string) {
  await page.evaluate((h) => (location.hash = h), hash);
  await settled(page);
}
/** Einen Zug spielen: mitten in der Lektion */
async function oneMove(page: Page) {
  await page.keyboard.press('ArrowRight');
  await render(page, 4);
  await expect(page.locator('[data-ks="count"]')).toHaveText('1 Zug');
}
/** Kein zweites Neuladen: Die neu geladene Seite hat gefragt (sie startet im sicheren Moment), keine Fassung wartet */
async function settledOnce(page: Page, loads: () => number) {
  await settled(page);
  await mark(page);
  await expect.poll(() => asked(page)).toBeGreaterThan(0);
  expect(await registration(page)).toEqual(ACTIVE);
  expect(await stays(page)).toBe(true);
  expect(loads()).toBe(1);
}

test('Zwei Fassungen: die alte Seite spielt mitten in einer Lektion weiter, die neue wartet und gilt ab dem nächsten Start', async ({
  page,
  context,
}) => {
  const [v1, v2] = [version('1'), version('2')];
  expect(v2.cache).not.toBe(v1.cache);
  expect(v2.chunk).not.toBe(v1.chunk);
  const errors = watchErrors(page);
  // (a) Fassung 1 steuert die Seite
  const loads = await openApp(page, '#lektion-1');
  await expect.poll(() => cacheNames(page)).toEqual([v1.cache]);
  await page.evaluate(() => {
    (window as unknown as { first: unknown }).first = navigator.serviceWorker.controller;
  });
  await oneMove(page);
  // (b) Fassung 2 geht live: Den alten Teil ks-menu gibt es auf dem Server nicht mehr
  await goLive(context);
  expect((await page.request.get(v1.chunk)).status()).toBe(404);
  await askForUpdate(page);
  // (c) Fassung 2 ist geladen und wartet, Fassung 1 bleibt aktiv und steuert die Seite
  await expect.poll(() => registration(page)).toEqual(WAITING);
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller === (window as unknown as { first: unknown }).first),
  ).toBe(true);
  expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
  // Die alte Seite spielt weiter, und auch ohne Netz bekommt sie ihren alten Teil ks-menu
  await page.keyboard.press('ArrowRight');
  await render(page, 4);
  await expect(page.locator('[data-ks="count"]')).toHaveText('2 Züge');
  await context.setOffline(true);
  expect(await fetchBytes(page, v1.chunk)).toBe(v1.chunkBytes);
  await context.setOffline(false);
  expect(loads()).toBe(0);
  expect(await stays(page)).toBe(true);
  expect(errors).toEqual([]);
  // (d) Alle Spielseiten zu, neu öffnen: Fassung 2 ist aktiv, der alte Cache ist weg
  await page.close();
  const next = await context.newPage();
  const nextErrors = watchErrors(next);
  await openApp(next);
  await expect.poll(() => registration(next)).toEqual(ACTIVE);
  await expect.poll(() => cacheNames(next)).toEqual([v2.cache]);
  expect(await fetchBytes(next, v2.chunk)).toBe(v2.chunkBytes);
  expect(nextErrors).toEqual([]);
});

test('Startbildschirm: Aus der Lektion zum Start, dort kommt die wartende Fassung, einmal neu geladen', async ({
  page,
  context,
}) => {
  const v2 = version('2');
  const errors = watchErrors(page);
  const loads = await openApp(page, '#lektion-1');
  await oneMove(page);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual(WAITING);
  expect(loads()).toBe(0); // eine wartende Fassung allein lädt nichts neu
  await go(page, '#start');
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  await expect(page).toHaveURL(/\/#start$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  await settledOnce(page, loads);
  expect(errors).toEqual([]);
});

test('„Geschafft!“: Nach dem Konfetti kommt die wartende Fassung, weiter mit Lektion 2, Bestwert gespeichert', async ({
  page,
  context,
}) => {
  const v2 = version('2');
  const errors = watchErrors(page);
  const loads = await openApp(page, '#lektion-1');
  await extras(page);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual(WAITING);
  expect(loads()).toBe(0); // mitten in der Lektion nicht, obwohl eine Fassung wartet
  await playLurd(page, LESSONS[0]!.sol);
  // Nach dem Konfetti (WIN_MS, echte Uhr). Nicht sofort nach dem Schild auf „noch nicht neu geladen“ prüfen: Auf
  // langsamen Läufern kann die Uhr schon abgelaufen sein
  await expect(page.locator('[data-ks="sign"]')).toHaveText(/^Geschafft!/);
  await expect.poll(loads, { timeout: WIN_MS + 30_000 }).toBe(1);
  await expect(page).toHaveURL(/\/#lektion-2$/);
  await expect(page.locator('[data-ks="title"]')).toHaveText(/^Lektion 2:/);
  expect(JSON.parse((await stored(page, 'best.e1')) ?? 'null')).toEqual({ moves: 9, pushes: 4 });
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  await expect.poll(() => registration(page)).toEqual(ACTIVE);
  await settled(page);
  expect(await registration(page)).toEqual(ACTIVE);
  expect(loads()).toBe(1);
  expect(errors).toEqual([]);
});

test('Mitten in einer Lektion wird nie neu geladen, auch nicht nach langer Pause; die neue Fassung wartet', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  const loads = await openApp(page, '#lektion-1');
  await oneMove(page);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual(WAITING);
  // Auslöser wie beim Wechsel in einen sicheren Moment und nach langer Pause – aber die Lektion läuft. Beide fragen nach
  // einer neuen Fassung und entscheiden dann
  const before = await asked(page);
  await page.evaluate((name) => document.dispatchEvent(new CustomEvent(name)), SAFE_EVENT);
  await page.evaluate(() => {
    let state = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
    const real = Date.now.bind(Date);
    Date.now = () => real() + 31 * 60_000;
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => asked(page)).toBeGreaterThanOrEqual(before + 2);
  expect(await stays(page)).toBe(true);
  expect(loads()).toBe(0);
  expect(await registration(page)).toEqual(WAITING);
  await expect(page.locator('[data-ks="count"]')).toHaveText('1 Zug');
  expect(errors).toEqual([]);
});

test('Öffnet das Kind zwischen Bitte und Übernahme eine Lektion, wird erst beim nächsten sicheren Moment neu geladen', async ({
  page,
  context,
}) => {
  // Die Bitte um skipWaiting wird angehalten, bis der Test sie freigibt: So öffnet das Kind die Lektion sicher genau
  // zwischen Bitte und Übernahme, auch wenn der Rechner langsam ist
  await page.addInitScript(() => {
    const post = Object.getOwnPropertyDescriptor(ServiceWorker.prototype, 'postMessage')!.value as (
      this: ServiceWorker,
      ...args: unknown[]
    ) => void;
    const w = window as unknown as { skipAsked?: boolean; releaseSkip?: () => void };
    ServiceWorker.prototype.postMessage = function (this: ServiceWorker, ...args: unknown[]) {
      if ((args[0] as { type?: string } | null)?.type !== 'skip-waiting') return post.apply(this, args);
      w.skipAsked = true;
      w.releaseSkip = () => post.apply(this, args);
    } as ServiceWorker['postMessage'];
  });
  const [v1, v2] = [version('1'), version('2')];
  const errors = watchErrors(page);
  const loads = await openApp(page, '#lektion-1');
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual(WAITING);
  // In die Levelwahl: sicher, die Seite bittet um die Übernahme …
  await go(page, '#level');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { skipAsked?: boolean }).skipAsked === true), {
      timeout: 30_000,
    })
    .toBe(true);
  // … das Kind öffnet Lektion 1 und spielt, dann übernimmt Fassung 2 – aber die Seite lädt nicht neu
  await go(page, '#lektion-1');
  await oneMove(page);
  await page.evaluate(() => (window as unknown as { releaseSkip: () => void }).releaseSkip());
  await expect.poll(() => registration(page)).toEqual(ACTIVE);
  await expect.poll(() => page.evaluate(() => (window as unknown as Probe).ksChanged)).toBe(true);
  expect(await stays(page)).toBe(true);
  expect(loads()).toBe(0);
  await expect(page.locator('[data-ks="count"]')).toHaveText('1 Zug');
  // Die Seite läuft noch mit Fassung 1: Ihr alter Cache bleibt, ihr alter Teil ks-menu kommt auch ohne Netz
  expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
  await context.setOffline(true);
  expect(await fetchBytes(page, v1.chunk)).toBe(v1.chunkBytes);
  await context.setOffline(false);
  // Zurück zum Startbildschirm: einmal neu geladen
  await go(page, '#start');
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  await settledOnce(page, loads);
  expect(errors).toEqual([]);
});

test('Neu laden auf dem Startbildschirm bringt die wartende Fassung (einmal mehr neu geladen)', async ({
  page,
  context,
}) => {
  const v2 = version('2');
  const errors = watchErrors(page);
  const loads = await openApp(page, '#lektion-1');
  await oneMove(page);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual(WAITING);
  // Adresse ohne Hash (kein Wechsel des Bildschirms), dann von Hand neu laden: Die Seite startet im sicheren Moment
  await page.evaluate(() => history.replaceState(null, '', '/'));
  await page.reload();
  await expect.poll(loads, { timeout: 30_000 }).toBe(2);
  await expect.poll(() => registration(page), { timeout: 30_000 }).toEqual(ACTIVE);
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  await settled(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Ein zweiter, alter Tab spielt ungestört weiter bis „Geschafft!“ und bekommt seinen alten Teil bis zuletzt', async ({
  page,
  context,
}) => {
  const [v1, v2] = [version('1'), version('2')];
  const errors = watchErrors(page);
  const loadsA = await openApp(page);
  const other = await context.newPage();
  const otherErrors = watchErrors(other);
  const loadsB = await openApp(other, '#lektion-1');
  await extras(other);
  await oneMove(other);
  await goLive(context);
  // Tab A wechselt in die Levelwahl: Er fragt, übernimmt Fassung 2 und lädt einmal neu
  await go(page, '#level');
  await expect.poll(loadsA, { timeout: 30_000 }).toBe(1);
  await settled(page);
  await expect.poll(() => registration(page)).toEqual(ACTIVE);
  // Tab B spielt weiter, lädt nicht neu und löst die Lektion mit Konfetti; auch danach nicht (keine Fassung wartet)
  expect(loadsB()).toBe(0);
  await other.keyboard.press('z'); // den Zug zurück, dann die Lösung
  await render(other, 4);
  // Vor der Lösung zählen: In der Lektion fragt Tab B nicht, und die Uhr nach „Geschafft!“ (WIN_MS) kann schon
  // abgelaufen sein, bevor der Test das Schild sieht
  const before = await asked(other);
  await playLurd(other, LESSONS[0]!.sol);
  await expect(other.locator('[data-ks="sign"]')).toHaveText(/^Geschafft!/);
  await mark(other);
  await expect.poll(() => asked(other), { timeout: WIN_MS + 30_000 }).toBeGreaterThan(before);
  expect(await stays(other)).toBe(true);
  expect(loadsB()).toBe(0);
  // Der alte Cache bleibt, solange Tab B offen ist: Er holt seinen alten Teil ks-menu auch ohne Netz, obwohl Fassung 2
  // ihn jetzt steuert und der Server die Datei nicht mehr hat
  expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
  await context.setOffline(true);
  expect(await fetchBytes(other, v1.chunk)).toBe(v1.chunkBytes);
  await context.setOffline(false);
  // … und geht, sobald eine Spielseite allein offen ist und sich meldet
  await other.close();
  await reloadGame(page);
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  expect([...errors, ...otherErrors]).toEqual([]);
});
