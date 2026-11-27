// Barrierefreiheit des Spiels: axe-core prüft die Bildschirme nach WCAG 2.2 A/AA, hell und dunkel (die 404-Seite:
// e2e/site.spec.ts). Das Gate fällt bei jedem Verstoß; die Liste nennt Regel, Wirkung und betroffene Elemente.
// Geprüft wird die ruhende Seite (reduzierte Bewegung).
import { expect, test } from '@playwright/test';
import { LESSONS } from '../src/data/games/lessons';
import { openGame, playLurd, violations } from './helpers';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

for (const colorScheme of ['light', 'dark'] as const)
  test.describe(`Farbschema ${colorScheme}`, () => {
    test.use({ colorScheme });

    test('Barrierefrei: Startbildschirm', async ({ page }) => {
      await openGame(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Startbildschirm mit Fortschritt', async ({ page }) => {
      await openGame(page, { store: { 'best.e1': { moves: 9, pushes: 4 }, 'skip.e2': true } });
      await expect(page.getByRole('link', { name: 'Weiterspielen: Lektion 3' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Startbildschirm mit geschaffter Einführung', async ({ page }) => {
      const store: Record<string, unknown> = {};
      for (let n = 1; n <= 15; n++) store[`best.e${n}`] = { moves: 9, pushes: 4 };
      await openGame(page, { store });
      await expect(page.getByRole('link', { name: 'Einführung wiederholen' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Einstellungen samt Handwahl', async ({ page }) => {
      await openGame(page, { hash: '#einstellungen' });
      await page.evaluate(() => document.documentElement.classList.add('touch'));
      await expect(page.getByRole('group', { name: 'Knöpfe' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Levelwahl', async ({ page }) => {
      await openGame(page, { hash: '#level' });
      await expect(page.getByRole('heading', { level: 2, name: 'Lektion wählen' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Levelwahl mit ✓, ↷, gesehen und goldener Karte', async ({ page }) => {
      await openGame(page, {
        hash: '#level',
        store: { 'best.e1': { moves: 9, pushes: 4 }, 'skip.e2': true, 'shown.e3': true },
      });
      await expect(page.locator('#lektion-4')).toHaveClass(/\bcur\b/);
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Levelwahl geschafft', async ({ page }) => {
      const store: Record<string, unknown> = {};
      for (let n = 1; n <= 15; n++) store[`shown.e${n}`] = true;
      await openGame(page, { hash: '#level', store });
      await expect(page.locator('[data-ks="intro-pill"]')).toHaveText('✓ geschafft');
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Spielfeld', async ({ page }) => {
      await openGame(page, { hash: '#lektion-1' });
      await expect(page.getByRole('heading', { level: 2, name: 'Lektion 1: Erster Schubs' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Spielfeld nach dem Sieg', async ({ page }) => {
      await openGame(page, { hash: '#lektion-1' });
      await playLurd(page, LESSONS[0]!.sol);
      await expect(page.getByRole('link', { name: 'Weiter zu Lektion 2' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Spielfeld mit Warnung', async ({ page }) => {
      await openGame(page, { hash: '#lektion-4', store: { 'skip.e1': true, 'skip.e2': true, 'skip.e3': true } });
      await playLurd(page, 'U');
      await expect(page.locator('[data-ks="sign"]')).toHaveClass('sign warn');
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Spielfeld mit Steuerkreuz und offenem Menü', async ({ page }) => {
      await openGame(page, { hash: '#lektion-1' });
      await page.evaluate(() => document.documentElement.classList.add('touch'));
      await expect(page.getByRole('group', { name: 'Laufen' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.getByRole('button', { name: 'Menü' }).click();
      await expect(page.getByRole('dialog', { name: 'Lektion 1: Erster Schubs' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Spielfeld mit Tipp', async ({ page }) => {
      await openGame(page, { hash: '#lektion-2', store: { 'skip.e1': true } });
      await page.keyboard.press('h');
      await expect(page.locator('[data-ks="sign"]')).toContainText('Tipp:');
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: gesperrte Lektion', async ({ page }) => {
      await openGame(page, { hash: '#lektion-5' });
      await expect(page.getByRole('heading', { level: 2, name: 'Diese Lektion ist noch zu' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
