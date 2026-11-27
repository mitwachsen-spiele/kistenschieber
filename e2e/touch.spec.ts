// Spielen mit dem Finger (Handy hochkant 390×844, Touch an): Antippen läuft hin, Kiste antippen zeigt Pfeile, ein Pfeil
// schiebt. Wischen macht keinen Schritt, der Finger scrollt die Seite, wenn sie höher als der Bildschirm ist (Issue
// #12). Das Steuerkreuz erscheint nach dem ersten Antippen und verschwindet mit einer Pfeiltaste; die linke Hand legt
// es nach links. Alle Ziele mindestens 48 px, kein Querscrollen. Mit Test-Uhr: gewartet wird nur auf Zustände.
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

test('ein Wisch macht keinen Schritt, in keine Richtung; Antippen läuft danach weiter', async ({ page }) => {
  // Kamera stark gedreht: auch entlang der Bildschirmrichtungen der Gitterrichtungen kein Schritt
  await openGame(page, { hash: '#lektion-1', store: { drehung: 45, neigung: 30 } });
  await touchOn(page);
  const field = (await box(page, FIELD))!;
  const [x, y] = [field.x + field.width / 2, field.y + field.height / 2];
  // Lektion 1: rechts der Figur ist frei, früher machte ein Wisch dorthin einen Schritt
  for (const d of screenDirs(makeCamera(45, 30))) {
    await swipe(page, x, y, d.x * 60, d.y * 60);
    await render(page, 8);
  }
  await expect(count(page)).toHaveText('0 Züge');
  await tap(page, { r: 5, c: 1 });
  await expect(count(page)).toHaveText('4 Züge');
});

test('das Feld lässt die Seite scrollen: kein touch-action none, nirgends preventDefault bei Touch', async ({
  page,
}) => {
  await openGame(page, { hash: '#lektion-1' });
  await touchOn(page);
  const styles = await page.evaluate(() =>
    ['#spiel .game', '#spiel .field canvas'].map((sel) => getComputedStyle(document.querySelector(sel)!).touchAction),
  );
  expect(styles).toEqual(['manipulation', 'manipulation']);
  // Ziehen zum Neuladen bleibt aus: Für den Viewport zählt nur der Wert am Wurzelelement, nicht der von body
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe('none');
  // Kein Pointer- oder Touch-Ereignis auf dem Feld wird abgefangen (sonst scrollte der Finger nicht)
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __prevented: string[] }).__prevented = seen;
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend'])
      addEventListener(type, (e) => void (e.defaultPrevented && seen.push(type)), { passive: true });
  });
  const field = (await box(page, FIELD))!;
  await swipe(page, field.x + field.width / 2, field.y + field.height / 2, 0, -80);
  await render(page, 8);
  expect(await page.evaluate(() => (window as unknown as { __prevented: string[] }).__prevented)).toEqual([]);
  await expect(count(page)).toHaveText('0 Züge');
});

test('hochkant niedriger als das Spielfeld (390×400): Wischen auf dem Feld scrollt die Seite, kein Schritt', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await openGame(page, { hash: '#lektion-1' });
  await touchOn(page);
  const room = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(room).toBeGreaterThan(40);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  // Die Insel bleibt ganz im Feld (nicht abgeschnitten) und liegt nicht unter dem Steuerkreuz
  const [area, board] = [(await box(page, '#spiel .field'))!, (await box(page, FIELD))!];
  expect(board.y).toBeGreaterThanOrEqual(area.y);
  expect(board.y + board.height).toBeLessThanOrEqual(area.y + area.height + 0.5);
  expect(apart(board, await box(page, '#spiel .pad'))).toBe(true);
  const field = board;
  await swipe(page, field.x + field.width / 2, field.y + field.height * 0.7, 0, -150);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await render(page, 8);
  await expect(count(page)).toHaveText('0 Züge');
  // Unten sind „Zug zurück“ und das Steuerkreuz erreichbar
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect(page.getByRole('button', { name: 'Zug zurück' })).toBeInViewport({ ratio: 1 });
  await pad(page).getByRole('button', { name: 'Links' }).tap();
  await render(page, 4);
  await expect(count(page)).toHaveText('1 Zug');
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

  test('hochkant niedrig 375×560: Felder mindestens 24 px; Warnung, Angebot und Sieg im Himmel über der Insel', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 560 });
    // Lektion 15 hat das größte Feld der Einführung: auch dort mindestens 24 px je Feld, ohne Scrollen
    await openGame(page, { hash: '#lektion-15', store: upTo(15) });
    await touchOn(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
    const [a, b] = [await spot(page, { r: 2, c: 2 }), await spot(page, { r: 2, c: 3 })];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(24);
    await page.evaluate(() => (location.hash = '#lektion-4'));
    await expect(count(page)).toHaveText('0 Züge');
    await render(page);
    const field = (await box(page, '#spiel .field'))!;
    const board = (await box(page, FIELD))!;
    expect(board.y + board.height).toBeLessThanOrEqual(field.y + field.height + 0.5);
    const shown = async () => {
      await page.locator('[data-ks="title"]').tap();
      await render(page);
      for (const part of [await box(page, '#spiel [data-ks="sign"]'), await box(page, '#spiel .after')]) {
        expect(apart(part, board)).toBe(true);
        if (part && part.height) expect(part.y).toBeGreaterThanOrEqual(field.y - 0.5);
      }
      expect(await box(page, FIELD)).toEqual(board);
    };
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
    await shown();
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

// Endpositionierung (Issue #15): Das Feld so groß wie möglich, Steuerkreuz, „Menü“ und „Zug zurück“ unten beim Daumen
// (quer an der Seite der Hand), alles ganz im Bild, mindestens 48 px, nichts überlappt. Quer bekommt das Feld die ganze
// Höhe: Titel und Zähler stehen oben in der Spalte daneben, nicht in einer eigenen Leiste
test.describe('Positionierung', () => {
  for (const [kind, width, height, share] of [
    ['Handy hochkant', 390, 844, 0.3],
    ['Handy hochkant', 360, 740, 0.3],
    ['Handy quer', 844, 390, 0.42],
    ['Handy quer', 740, 360, 0.42],
    ['Tablet hochkant', 820, 1180, 0.5],
    ['Tablet quer', 1180, 820, 0.5],
  ] as const)
    for (const hand of ['rechts', 'links'] as const)
      test(`${kind} ${width}×${height}, ${hand === 'rechts' ? 'rechte' : 'linke'} Hand: großes Feld, Knöpfe beim Daumen, nichts verdeckt`, async ({
        page,
      }) => {
        const landscape = width > height;
        await page.setViewportSize({ width, height });
        await openGame(page, { hash: '#lektion-15', store: { ...upTo(15), hand } });
        await touchOn(page);
        // größtes (15) und kleines Feld (1) der Einführung
        for (const n of [15, 1]) {
          if (n !== 15) {
            await page.evaluate((h) => (location.hash = h), `#lektion-${n}`);
            await expect(page.locator('[data-ks="title"]')).toContainText(`Lektion ${n}:`);
            await render(page);
          }
          const board = (await box(page, FIELD))!;
          // Feldanteil: Die Insel bedeckt einen großen Teil des Bildschirms und füllt ihr Feld in Breite oder Höhe aus
          // (hochkant die Breite); auf dem Handy quer nutzt sie (fast) die ganze Höhe
          const field = (await box(page, '#spiel .field'))!;
          if (n === 15) expect((board.width * board.height) / (width * height)).toBeGreaterThanOrEqual(share);
          if (landscape) expect(board.width >= field.width - 12 || board.height >= field.height - 12).toBe(true);
          else expect(board.width).toBeGreaterThanOrEqual(field.width - 12);
          if (landscape && height < 500) expect(board.height / height).toBeGreaterThanOrEqual(0.85);
          const parts = {
            menu: await box(page, '#spiel [data-ks="menu"]'),
            undo: await box(page, '#spiel [data-ks="undo"]'),
            pad: await box(page, '#spiel .pad'),
            bar: await box(page, '#spiel .gbar'),
          };
          const keys = await page.locator('#spiel .pad button').evaluateAll((els) =>
            els.map((el) => {
              const r = el.getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height };
            }),
          );
          for (const b of [parts.menu, parts.undo, ...keys]) {
            expect(b).not.toBeNull();
            // ganz im Bild, mindestens 48 px, in der unteren Hälfte (Daumen), nicht über der Insel
            expect(b!.x).toBeGreaterThanOrEqual(0);
            expect(b!.y).toBeGreaterThanOrEqual(0);
            expect(b!.x + b!.width).toBeLessThanOrEqual(width);
            expect(b!.y + b!.height).toBeLessThanOrEqual(height);
            expect(Math.min(b!.width, b!.height)).toBeGreaterThanOrEqual(48);
            expect(b!.y + b!.height / 2).toBeGreaterThan(height / 2);
            expect(apart(b, board)).toBe(true);
          }
          for (const [a, b] of [
            [parts.menu, parts.undo],
            [parts.menu, parts.pad],
            [parts.undo, parts.pad],
            [parts.bar, board],
            [parts.bar, parts.pad],
          ] as const)
            expect(apart(a, b)).toBe(true);
          // Das Steuerkreuz liegt am Rand der Hand; quer steht die Spalte samt Kopf auf der Seite der Hand
          const p = parts.pad!;
          if (hand === 'rechts') expect(p.x + p.width).toBeGreaterThan(width - 40);
          else expect(p.x).toBeLessThan(40);
          // „Zug zurück“ über „Menü“, beide dicht beim Steuerkreuz, aber mindestens 16 px daneben (kein Fehltipp)
          const undo = parts.undo!;
          const menu = parts.menu!;
          expect(undo.y + undo.height).toBeLessThanOrEqual(menu.y);
          const sideGap = hand === 'rechts' ? p.x - (undo.x + undo.width) : undo.x - (p.x + p.width);
          expect(sideGap).toBeGreaterThanOrEqual(16);
          expect(sideGap).toBeLessThanOrEqual(40);
          // Hochkant steht die Insel mittig unter dem Platz für Meldungen: der Himmel verteilt sich über und unter ihr
          if (!landscape) {
            const room = await page
              .locator('#spiel .field')
              .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
            const above = board.y - field.y - room;
            const below = field.y + field.height - (board.y + board.height);
            expect(Math.abs(above - below)).toBeLessThanOrEqual(4);
          }
          if (landscape) {
            const bar = parts.bar!;
            if (hand === 'rechts') expect(bar.x).toBeGreaterThanOrEqual(board.x + board.width);
            else expect(bar.x + bar.width).toBeLessThanOrEqual(board.x);
          } else expect(parts.bar!.y + parts.bar!.height).toBeLessThanOrEqual(board.y);
          // kein Scrollen
          const overflow = await page.evaluate(() => ({
            x: document.documentElement.scrollWidth - innerWidth,
            y: document.documentElement.scrollHeight - innerHeight,
          }));
          expect(overflow).toEqual({ x: 0, y: 0 });
        }
      });
});
