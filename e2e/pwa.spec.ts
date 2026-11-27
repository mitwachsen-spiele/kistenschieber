// Das Spiel als App: Der Service Worker steuert die ganze Adresse, und ohne Netz startet das Spiel trotzdem und lässt
// sich spielen. Manifest: e2e/site.spec.ts, installierbar laut Chromium: e2e/installable.spec.ts, Updates:
// e2e/pwa-update.spec.ts. Spec: docs/specs/kistenschieber.md („App“).
// Im Projekt `game` sind Service Worker sonst gesperrt; diese Datei lässt sie zu.
import { expect, test } from '@playwright/test';
import { LESSONS } from '../src/data/games/lessons';
import { extras, openGame, playLurd, reloadGame, stored, watchErrors } from './helpers';

test.use({ serviceWorkers: 'allow' });

test('Service Worker steuert / mit updateViaCache none; ohne Netz startet das Spiel und Lektion 1 lässt sich lösen', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  await openGame(page);
  // Bereit heißt: alles gespeichert (install) und aktiv; clients.claim() übernimmt die offene Seite
  const reg = await page.evaluate(() =>
    navigator.serviceWorker.ready.then((r) => ({ scope: r.scope, updateViaCache: r.updateViaCache })),
  );
  expect(new URL(reg.scope).pathname).toBe('/');
  // Die Frage nach einer neuen Version geht am HTTP-Cache vorbei, nie 'all'
  expect(reg.updateViaCache).toBe('none');
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
    .toMatch(/\/sw\.js$/);

  await context.setOffline(true);
  const fromSw: string[] = [];
  page.on('response', (r) => {
    if (r.fromServiceWorker()) fromSw.push(new URL(r.url()).pathname);
  });
  await reloadGame(page);
  expect(fromSw).toContain('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
  // Lektion 1 öffnen: Auch der nachgeladene Teil (Konfetti) kommt ohne Netz aus dem Speicher
  await page.getByRole('link', { name: 'Spielen', exact: true }).click();
  await expect(page).toHaveURL(/#lektion-1$/);
  await extras(page);
  expect(
    fromSw.some((p) => /\/ks-menu\.[\w-]+\.js$/.test(p)),
    fromSw.join(', '),
  ).toBe(true);
  await playLurd(page, LESSONS[0]!.sol);
  await expect(page.locator('[data-ks="sign"]')).toHaveText(/^Geschafft!/);
  expect(JSON.parse((await stored(page, 'best.e1')) ?? 'null')).toEqual({ moves: 9, pushes: 4 });
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
