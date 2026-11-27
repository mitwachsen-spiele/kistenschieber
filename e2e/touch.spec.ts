// Spielen mit dem Finger (Handy hochkant 390×844, Touch an): Antippen läuft hin, Kiste antippen zeigt Pfeile, ein Pfeil
// schiebt, Wischen macht einen Schritt in die Richtung, die auf dem Bildschirm passt. Das Steuerkreuz erscheint nach
// dem ersten Antippen und verschwindet mit einer Pfeiltaste; die linke Hand legt es nach links. Alle Ziele mindestens
// 48 px, kein Querscrollen. Mit Test-Uhr: gewartet wird nur auf Zustände.
import { expect, test, type Page } from '@playwright/test';
import { makeCamera, screenDirs } from '../src/lib/games/oblique/camera';
import { SIGN } from '../src/data/games/texts';
import { ARROW_FILL } from '../src/data/games/kaje';
import { padAngles } from '../src/scripts/games/ks-input';
import { LESSONS } from '../src/data/games/lessons';
import { apart, box, colourCount, openGame, playLurd, render, spot, swipe } from './helpers';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

const FIELD = '#spiel canvas';
const count = (page: Page) => page.locator('[data-ks="count"]');
const sign = (page: Page) => page.locator('[data-ks="sign"]');
const pad = (page: Page) => page.getByRole('group', { name: 'Laufen' });
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as [number, number, number];

/** Lektionen 1 bis n−1 als übersprungen: Lektion n ist frei */
function upTo(n: number): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  for (let k = 1; k < n; k++) store[`skip.e${k}`] = true;
  return store;
}

/** Erstes Antippen (auf den Titel) schaltet Touch ein: Das Steuerkreuz erscheint, das Feld wird neu gezeichnet */
async function touchOn(page: Page) {
  await page.locator('[data-ks="title"]').tap();
  await expect(page.locator('html')).toHaveClass(/\btouch\b/);
  await expect(pad(page)).toBeVisible();
  await render(page);
}

/** Antippen und den Laufweg zu Ende zeichnen */
async function tap(page: Page, s: Parameters<typeof spot>[1]) {
  const p = await spot(page, s);
  await page.touchscreen.tap(p.x, p.y);
  await render(page, 40);
}

test('Antippen eines erreichbaren Bodenfelds: die Figur läuft hin, als ein Zug zum Zurücknehmen', async ({ page }) => {
  await openGame(page, { hash: '#lektion-1' });
  await touchOn(page);
  await tap(page, { r: 5, c: 1 });
  await expect(count(page)).toHaveText('4 Züge');
  await page.getByRole('button', { name: 'Zug zurück' }).tap();
  await render(page);
  await expect(count(page)).toHaveText('0 Züge');
  await page.getByRole('button', { name: 'Zug zurück' }).tap();
  await expect(sign(page)).toHaveText(SIGN.atStart);
});

test('Kiste antippen zeigt goldene Pfeile; ein Pfeil schiebt sie', async ({ page }) => {
  await openGame(page, { hash: '#lektion-1' });
  await touchOn(page);
  const gold = hex(ARROW_FILL.sel);
  expect(await colourCount(page, FIELD, gold)).toBe(0);
  await tap(page, { crate: 0 });
  expect(await colourCount(page, FIELD, gold)).toBeGreaterThan(50);
  // Pfeil links der Kiste: die Figur läuft hinter die Kiste und schiebt sie einmal
  await tap(page, { r: 3, c: 4 });
  await expect(count(page)).toHaveText('6 Züge');
  expect(await colourCount(page, FIELD, gold)).toBe(0);
});

test('noch einmal auf die Kiste hebt die Auswahl auf', async ({ page }) => {
  await openGame(page, { hash: '#lektion-1' });
  await touchOn(page);
  const gold = hex(ARROW_FILL.sel);
  await tap(page, { crate: 0 });
  expect(await colourCount(page, FIELD, gold)).toBeGreaterThan(50);
  await tap(page, { crate: 0 });
  expect(await colourCount(page, FIELD, gold)).toBe(0);
  await expect(count(page)).toHaveText('0 Züge');
});

test('eine Kiste ohne Möglichkeit antippen: „Diese Kiste lässt sich gerade nirgendwohin schieben.“', async ({
  page,
}) => {
  await openGame(page, { hash: '#lektion-4', store: upTo(4) });
  await playLurd(page, 'ruLLdlU'); // Kiste in die Ecke
  await touchOn(page);
  await tap(page, { crate: 0 });
  await expect(sign(page)).toHaveText(SIGN.noOptions);
});

test('ein Wisch über 60 px macht einen Schritt in die Richtung, die auf dem Bildschirm passt', async ({ page }) => {
  // Kamera stark gedreht: Bildschirm- und Gitterrichtung liegen weit auseinander
  await openGame(page, { hash: '#lektion-1', store: { drehung: 45, neigung: 30 } });
  await touchOn(page);
  const dirs = screenDirs(makeCamera(45, 30));
  const box = (await page.locator(FIELD).boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  const along = async (name: string) => {
    const d = dirs.find((s) => s.name === name)!;
    await swipe(page, x, y, d.x * 60, d.y * 60);
    await render(page, 4);
  };
  // Lektion 1: rechts der Figur zwei Felder frei, dann Wand; links, oben (Wand) und unten (Wand) ergäben anderes
  await along('right');
  await expect(count(page)).toHaveText('1 Zug');
  await along('right');
  await along('right');
  await expect(count(page)).toHaveText('2 Züge');
  await along('up');
  await expect(count(page)).toHaveText('3 Züge');
});

test('ein kurzer Wisch (unter 28 px) ist ein Tippen, kein Schritt', async ({ page }) => {
  await openGame(page, { hash: '#lektion-1' });
  await touchOn(page);
  const p = await spot(page, { r: 5, c: 4 });
  await swipe(page, p.x, p.y, 15, 0);
  await render(page, 8);
  // Getippt auf das Feld links der Figur: ein Zug dorthin
  await expect(count(page)).toHaveText('1 Zug');
});

test.describe('Steuerkreuz', () => {
  test('mit einer Pfeiltaste weg, erst nach dem Antippen wieder da; seine Knöpfe laufen', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await page.keyboard.press('ArrowRight');
    await render(page, 4);
    await expect(pad(page)).toBeHidden();
    await expect(count(page)).toHaveText('1 Zug');
    await touchOn(page);
    for (const name of ['Hoch', 'Links', 'Rechts', 'Runter'])
      await expect(pad(page).getByRole('button', { name })).toBeVisible();
    await pad(page).getByRole('button', { name: 'Links' }).tap();
    await render(page, 4);
    await expect(count(page)).toHaveText('2 Züge');
    await page.keyboard.press('ArrowRight');
    await render(page, 4);
    await expect(pad(page)).toBeHidden();
    await expect(count(page)).toHaveText('3 Züge');
  });

  test('die Pfeile zeigen in die Bildschirmrichtung der Kamera', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1', store: { drehung: 30, neigung: 40 } });
    const want = padAngles(screenDirs(makeCamera(30, 40)));
    const got = await page
      .locator('.pad button')
      .evaluateAll((bs) => bs.map((b) => [(b as HTMLElement).dataset.pad, b.querySelector('svg')!.style.transform]));
    expect(Object.fromEntries(got)).toEqual(
      Object.fromEntries(Object.entries(want).map(([k, v]) => [k, `rotate(${v}deg)`])),
    );
  });

  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ] as const)
    test(`${width}×${height}: rechte Hand rechts, „Linke Hand“ legt das Steuerkreuz nach links`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openGame(page, { hash: '#lektion-1' });
      await touchOn(page);
      const right = await page.locator('#spiel .pad').boundingBox();
      expect(right!.x + right!.width).toBeGreaterThan(width - 40);
      await page.evaluate(() => localStorage.setItem('kistenschieber.hand', '"links"'));
      await page.reload();
      await expect(page.locator('ks-kistenschieber')).toHaveClass(/\bsettled\b/);
      await touchOn(page);
      await expect(page.locator('#spiel .gin')).toHaveClass(/\bleft\b/);
      const left = await page.locator('#spiel .pad').boundingBox();
      const acts = await page.locator('#spiel .gacts').boundingBox();
      const field = await page.locator('#spiel .field').boundingBox();
      expect(left!.x).toBeLessThan(40);
      if (width > height) expect(left!.x + left!.width).toBeLessThanOrEqual(field!.x + 1);
      else expect(left!.x).toBeLessThan(acts!.x);
    });
});

test.describe('ohne Touch', () => {
  test.use({ hasTouch: false });

  test('am Schreibtisch kein Steuerkreuz', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await expect(page.locator('html')).not.toHaveClass(/\btouch\b/);
    await expect(pad(page)).toBeHidden();
  });
});

test.describe('Ziele und Platz', () => {
  test('quer 667×375: Warnung, Angebot und Sieg stehen neben dem Feld über dem Steuerkreuz, das Feld bleibt gleich', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await openGame(page, { hash: '#lektion-4', store: upTo(4) });
    await touchOn(page);
    const field = await box(page, '#spiel .field');
    const board = await box(page, FIELD);
    const shown = async () => {
      // Tasten schalten Touch aus, Antippen wieder ein
      await page.locator('[data-ks="title"]').tap();
      await expect(page.locator('html')).toHaveClass(/\btouch\b/);
      await render(page);
      const parts = [await box(page, '#spiel [data-ks="sign"]'), await box(page, '#spiel .after')];
      for (const b of parts) {
        expect(apart(b, board)).toBe(true);
        expect(apart(b, await box(page, '#spiel .pad'))).toBe(true);
      }
      expect(await box(page, '#spiel .field')).toEqual(field);
      expect(await box(page, FIELD)).toEqual(board);
      return parts;
    };
    // Kiste in die Ecke oben links (zwei Rückschläge), Neustart als dritter: Warnung, dann das Angebot
    await playLurd(page, 'ruLLdlU');
    await expect(sign(page)).toHaveClass('sign warn');
    await shown();
    await page.keyboard.press('r');
    await render(page, 4);
    await expect(page.getByRole('button', { name: 'Zu knifflig? Überspringen' })).toBeVisible();
    await shown();
    await page.keyboard.press('r');
    await render(page, 4);
    await playLurd(page, LESSONS[3]!.sol);
    await expect(sign(page)).toHaveText(/^Geschafft!/);
    const [, after] = await shown();
    expect(after!.height).toBeGreaterThan(40);
    // Nach dem Sieg geht kein Schritt mehr: Das Steuerkreuz ist weg, behält aber seine Breite
    await expect(pad(page)).toBeHidden();
  });

  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [320, 640],
  ] as const)
    test(`${width}×${height}: alle Knöpfe mindestens 48 px, kein Querscrollen, auch mit offenem Menü`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openGame(page, { hash: '#lektion-1' });
      await touchOn(page);
      const small = () =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('#spiel button, #spiel a, #spiel canvas')]
            .filter((el) => el.checkVisibility())
            .map((el) => ({
              name: el.textContent?.trim() || el.getAttribute('aria-label'),
              r: el.getBoundingClientRect(),
            }))
            .filter(({ r }) => r.width < 48 || r.height < 48)
            .map(({ name, r }) => `${name}: ${Math.round(r.width)}×${Math.round(r.height)}`),
        );
      expect(await small()).toEqual([]);
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(await overflow()).toBeLessThanOrEqual(0);
      await page.getByRole('button', { name: 'Menü' }).tap();
      await expect(page.getByRole('dialog', { name: 'Lektion 1: Erster Schubs' })).toBeVisible();
      expect(await small()).toEqual([]);
      expect(await overflow()).toBeLessThanOrEqual(0);
    });
});
