// Barrierefreiheit des Spiels: axe-core prüft die Bildschirme nach WCAG 2.2 A/AA, hell und dunkel (die 404-Seite:
// e2e/site.spec.ts). Das Gate fällt bei jedem Verstoß; die Liste nennt Regel, Wirkung und betroffene Elemente.
// Geprüft wird die ruhende Seite (reduzierte Bewegung).
import { expect, test } from '@playwright/test';
import { openGame, violations } from './helpers';

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

    test('Barrierefrei: Einstellungen samt Handwahl', async ({ page }) => {
      await openGame(page, { hash: '#einstellungen' });
      await page.evaluate(() => document.documentElement.classList.add('touch'));
      await expect(page.getByRole('group', { name: 'Knöpfe' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('Barrierefrei: Levelwahl', async ({ page }) => {
      await openGame(page, { hash: '#level' });
      await expect(page.getByRole('heading', { level: 2, name: 'Level wählen' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
