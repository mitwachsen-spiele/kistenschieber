// Der Platzhalter, bis das Spiel kommt: Startseite und 404 laden ohne Fehler in der Konsole, führen zu dem, was es schon
// gibt, bleiben auf dem Handy ohne seitliches Scrollen, sind nicht im Suchindex und barrierefrei.
import { expect, test } from '@playwright/test';
import { violations, watchErrors } from './helpers';

const HOME = 'https://www.mitwachsen-spiele.de/';

test('Startseite lädt ohne Fehler und führt zu Weltenbummler und zur Homepage', async ({ page }) => {
  const errors = watchErrors(page);
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
  await expect(page.getByText('Hier kommt bald was')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Weltenbummler' })).toHaveAttribute(
    'href',
    'https://weltenbummler.mitwachsen-spiele.de/',
  );
  await expect(page.getByRole('link', { name: 'Zur Startseite' })).toHaveAttribute('href', HOME);
  const footer = page.locator('footer.site-footer');
  await expect(footer.getByRole('link', { name: 'Impressum und Kontakt' })).toHaveAttribute(
    'href',
    'https://larmic.de/impressum/',
  );
  await expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', `${HOME}datenschutz/`);
  expect(errors).toEqual([]);
});

test('Platzhalter ist nicht im Suchindex und meldet keinen Service Worker an', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBe(0);
});

for (const width of [320, 390, 1280])
  test(`Startseite bei ${width} px ohne seitliches Scrollen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

test('Unbekannte Adresse zeigt die 404-Seite', async ({ page }) => {
  const res = await page.goto('/gibt-es-nicht/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: /404/ })).toBeVisible();
});

test.describe('ruhende Seiten', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  for (const path of ['/', '/gibt-es-nicht/'])
    test(`Barrierefrei: ${path}`, async ({ page }) => {
      await page.goto(path);
      expect(await violations(page)).toEqual([]);
    });
});
