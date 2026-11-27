// Spielen mit der Tastatur bis „Geschafft!“: Spielfeld, Zähler, Schild, Zug zurück, Neustart, Nochmal, Sackgassen und
// das Angebot zum Überspringen, Bestwert und „weiter“. Mit Test-Uhr: Jeder Schritt läuft erst, wenn der Test Bilder
// zeichnet (`render`, `playLurd`); gewartet wird nur auf Zustände (Text, Klassen, Attribute).
import { expect, test, type Page } from '@playwright/test';
import { LESSONS } from '../src/data/games/lessons';
import { CONFETTI_LIFE } from '../src/lib/games/sokoban/scene';
import { colourCount, drawn, game, openGame, pixels, playLurd, render, stored, watchErrors } from './helpers';

const FIELD = '#spiel canvas';
/** Rand einer festsitzenden Kiste (#e0442f, data/games/kaje.ts) */
const STUCK_RED = [0xe0, 0x44, 0x2f] as const;

const lesson = (n: number) => LESSONS[n - 1]!;
const spiel = (page: Page) => page.locator('ks-kistenschieber > section#spiel');
const sign = (page: Page) => page.locator('[data-ks="sign"]');
const count = (page: Page) => page.locator('[data-ks="count"]');

/** Lektionen 1 bis n−1 als übersprungen: Lektion n ist frei */
function upTo(n: number): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  for (let k = 1; k < n; k++) store[`skip.e${k}`] = true;
  return store;
}

/** Eine Taste wirklich drücken und den Schritt zu Ende zeichnen */
async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await render(page, 4);
}

test.describe('Spielfeld', () => {
  test('Lektion 1: Titel, Zähler, Feld, Schild mit dem Intro, Knöpfe; gemerkt als letzte; ohne Fehler', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openGame(page, { hash: '#lektion-1' });
    const s = spiel(page);
    await expect(s).toBeVisible();
    await expect(game(page)).toHaveClass(/\bplaying\b/);
    await expect(page.locator('body')).toHaveClass(/\bplaying\b/);
    await expect(page).toHaveTitle('Lektion 1 · Kistenschieber');
    await expect(s.getByRole('heading', { level: 2, name: 'Lektion 1: Erster Schubs' })).toBeVisible();
    await expect(s.getByRole('button', { name: 'Menü' })).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(count(page)).toHaveText('0 Züge');
    const field = s.getByRole('img', {
      name: 'Lektion 1: Erster Schubs. Antippen, Wischen oder Pfeiltasten bewegen die Figur.',
    });
    await expect(field).toBeVisible();
    await expect(field).toHaveAttribute('tabindex', '0');
    expect(await drawn(page, FIELD)).toBe(true);
    await expect(sign(page)).toHaveText(lesson(1).intro);
    await expect(sign(page)).toHaveAttribute('aria-live', 'polite');
    await expect(sign(page)).toHaveClass('sign');
    await expect(s.getByRole('button', { name: 'Zug zurück' })).toBeVisible();
    await expect(s.getByRole('button', { name: 'Tipp' })).toBeVisible();
    await expect(s.getByRole('link', { name: 'Weiter zu Lektion 2' })).toBeHidden();
    await expect(s.getByRole('button', { name: 'Nochmal' })).toBeHidden();
    await expect(s.getByRole('button', { name: 'Zu knifflig? Überspringen' })).toBeHidden();
    expect(await stored(page, 'last')).toBe('"e1"');
    expect(errors).toEqual([]);
  });

  test('Lektion 1 mit den Tasten ihrer Lösung: „Geschafft!“, Bestwert, Enter führt zu Lektion 2', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { hash: '#lektion-1' });
    await press(page, 'ArrowRight');
    await expect(count(page)).toHaveText('1 Zug');
    await press(page, 'd'); // WASD: d = rechts
    await expect(count(page)).toHaveText('2 Züge');
    for (const key of ['ArrowUp', 'w', 'ArrowLeft', 'ArrowLeft', 'a', 'ArrowLeft', 'ArrowLeft']) await press(page, key);
    await expect(sign(page)).toHaveText('Geschafft! 9 Züge, kürzer geht es nicht.');
    await expect(sign(page)).toHaveClass('sign win');
    await expect(count(page)).toHaveText('9 Züge');
    expect(JSON.parse((await stored(page, 'best.e1')) ?? 'null')).toEqual({ moves: 9, pushes: 4 });
    const next = spiel(page).getByRole('link', { name: 'Weiter zu Lektion 2' });
    await expect(next).toBeVisible();
    await expect(next).toHaveAttribute('href', '#lektion-2');
    await expect(spiel(page).getByRole('button', { name: 'Nochmal' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#lektion-2$/);
    await expect(spiel(page).getByRole('heading', { level: 2, name: 'Lektion 2: Um die Ecke' })).toBeVisible();
    await expect(count(page)).toHaveText('0 Züge');
    await expect(sign(page)).toHaveText(lesson(2).intro);
    expect(await stored(page, 'last')).toBe('"e2"');
    expect(errors).toEqual([]);
  });

  test('Z nimmt den Sieg zurück, R und Z stellen den alten Stand her, „Nochmal“ beginnt ohne Verlauf', async ({
    page,
  }) => {
    await openGame(page, { hash: '#lektion-1' });
    await playLurd(page, lesson(1).sol);
    await expect(sign(page)).toHaveText(/^Geschafft!/);
    await press(page, 'z');
    await expect(count(page)).toHaveText('8 Züge');
    await expect(sign(page)).toHaveText(lesson(1).intro);
    await expect(spiel(page).getByRole('link', { name: 'Weiter zu Lektion 2' })).toBeHidden();
    await press(page, 'r');
    await expect(count(page)).toHaveText('0 Züge');
    await expect(sign(page)).toHaveText('Neu gestartet. Mit „Zug zurück“ kommst du zum alten Stand.');
    await press(page, 'Z');
    await expect(count(page)).toHaveText('8 Züge');
    await press(page, 'ArrowLeft');
    await expect(sign(page)).toHaveText('Geschafft! 9 Züge, kürzer geht es nicht.');
    await spiel(page).getByRole('button', { name: 'Nochmal' }).click();
    await render(page);
    await expect(count(page)).toHaveText('0 Züge');
    await expect(sign(page)).toHaveText(lesson(1).intro);
    await expect(spiel(page).getByRole('button', { name: 'Nochmal' })).toBeHidden();
    await spiel(page).getByRole('button', { name: 'Zug zurück' }).click();
    await expect(sign(page)).toHaveText('Ganz am Anfang, weiter zurück geht es nicht.');
    await press(page, 'Backspace');
    await expect(count(page)).toHaveText('0 Züge');
  });

  test('Lektion 4: Kiste in die Ecke – Warnung und roter Rand; drei Rückschläge bieten das Überspringen an', async ({
    page,
  }) => {
    await openGame(page, { hash: '#lektion-4', store: upTo(4) });
    const redBefore = await colourCount(page, FIELD, STUCK_RED);
    // rechts, hoch, zweimal links schieben: Die Kiste steht an der linken Wand (Rückschlag 1)
    await playLurd(page, 'ruLL');
    await expect(sign(page)).toHaveText('Diese Kiste kommt hier nicht mehr weg. Mit „Zug zurück“ geht es weiter.');
    await expect(sign(page)).toHaveClass('sign warn');
    // runter, links, hoch schieben: in die Ecke oben links (Rückschlag 2)
    await playLurd(page, 'dlU');
    await expect(sign(page)).toHaveClass('sign warn');
    expect(await colourCount(page, FIELD, STUCK_RED)).toBeGreaterThan(redBefore + 50);
    const offer = spiel(page).getByRole('button', { name: 'Zu knifflig? Überspringen' });
    await expect(offer).toBeHidden();
    await press(page, 'r'); // Rückschlag 3
    await expect(offer).toBeVisible();
    expect(await colourCount(page, FIELD, STUCK_RED)).toBeLessThan(redBefore + 50);
    await offer.click();
    await expect(page).toHaveURL(/#lektion-5$/);
    expect(await stored(page, 'skip.e4')).toBe('true');
  });

  test('Lektion 15: Sieg mit dem Zusatz zur Einführung und „Zur Levelwahl“', async ({ page }) => {
    await openGame(page, { hash: '#lektion-15', store: upTo(15) });
    const l = lesson(15);
    await playLurd(page, l.sol);
    await expect(sign(page)).toHaveText(
      `Geschafft! ${l.moves} Züge, kürzer geht es nicht. Damit ist die Einführung geschafft.`,
    );
    const next = spiel(page).getByRole('link', { name: 'Zur Levelwahl' });
    await expect(next).toHaveAttribute('href', '#level');
    await next.click();
    await expect(page.getByRole('heading', { level: 2, name: 'Level wählen' })).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/\bplaying\b/);
  });

  test('Lektion 3: „Die Kiste steht.“, die nächste Aktion bringt das Intro zurück', async ({ page }) => {
    await openGame(page, { hash: '#lektion-3', store: upTo(3) });
    await playLurd(page, 'uLdlUU');
    await expect(sign(page)).toHaveText('Die Kiste steht.');
    await expect(sign(page)).toHaveClass('sign');
    await press(page, 'ArrowDown');
    await expect(sign(page)).toHaveText(lesson(3).intro);
  });

  test('#lektion-2 merkt sich „e2“, die gesperrte #lektion-9 nicht', async ({ page }) => {
    await openGame(page, { hash: '#lektion-2', store: { 'best.e1': { moves: 9, pushes: 4 } } });
    expect(await stored(page, 'last')).toBe('"e2"');
    await page.evaluate(() => (location.hash = '#lektion-9'));
    await expect(page.getByRole('heading', { level: 2, name: 'Diese Lektion ist noch zu' })).toBeVisible();
    await expect(spiel(page)).toBeHidden();
    await expect(game(page)).not.toHaveClass(/\bplaying\b/);
    expect(await stored(page, 'last')).toBe('"e2"');
  });

  test('„Dahinter ist kein Platz für die Kiste.“ zählt keinen Zug', async ({ page }) => {
    await openGame(page, { hash: '#lektion-3', store: upTo(3) });
    // hoch, links: Kiste an die linke Wand; noch einmal links: dahinter ist die Wand
    await playLurd(page, 'uLL');
    await expect(sign(page)).toHaveText('Dahinter ist kein Platz für die Kiste.');
    await expect(count(page)).toHaveText('2 Züge');
  });

  test('Tasten mit Strg oder Alt zählen nicht; Enter auf einem Knopf löst nur den Knopf aus', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await press(page, 'Control+ArrowRight');
    await press(page, 'Alt+ArrowRight');
    await expect(count(page)).toHaveText('0 Züge');
    await playLurd(page, lesson(1).sol);
    await spiel(page).getByRole('button', { name: 'Nochmal' }).focus();
    await page.keyboard.press('Enter');
    await render(page);
    await expect(page).toHaveURL(/#lektion-1$/);
    await expect(count(page)).toHaveText('0 Züge');
    // Der Knopf ist jetzt versteckt: Der Fokus geht aufs Feld, nicht verloren an <body>
    await expect(page.locator(FIELD)).toBeFocused();
    await playLurd(page, lesson(1).sol);
    await spiel(page).getByRole('link', { name: 'Weiter zu Lektion 2' }).focus();
    await press(page, 'z');
    await expect(spiel(page).getByRole('link', { name: 'Weiter zu Lektion 2' })).toBeHidden();
    await expect(page.locator(FIELD)).toBeFocused();
  });

  test('ein Klick auf eine Karte öffnet das Spiel, der Fokus liegt auf dem Feld', async ({ page }) => {
    await openGame(page, { hash: '#level' });
    await page.locator('#lektion-1').click();
    await expect(page.locator(FIELD)).toBeFocused();
    await expect(spiel(page)).toBeVisible();
  });
});

test.describe('Konfetti', () => {
  // Die Teilchen sind klein und schattiert, ihre Farben daher kaum genau zu zählen. Verglichen wird das ganze Feld:
  // nach dem Sieg (ohne Konfetti) steht es still, jedes Bild gleicht dem, wenn alle Teilchen verglüht sind.
  /** So lange zeichnen, bis jedes Teilchen sicher verglüht ist */
  const settle = (page: Page) => render(page, Math.ceil((CONFETTI_LIFE + 200) / 16), 16);

  test('nach dem Sieg fliegt Konfetti, das von selbst verglüht', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await playLurd(page, lesson(1).sol);
    await render(page, 8);
    const flying = await pixels(page, FIELD);
    await settle(page);
    const still = await pixels(page, FIELD);
    expect(flying).not.toBe(still);
    await render(page, 8);
    expect(await pixels(page, FIELD)).toBe(still);
  });

  test('Zug zurück räumt das Konfetti sofort weg', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await playLurd(page, lesson(1).sol);
    await render(page, 8);
    await press(page, 'z');
    const afterUndo = await pixels(page, FIELD);
    await settle(page);
    expect(afterUndo).toBe(await pixels(page, FIELD));
  });

  test('bei reduzierter Bewegung kein Konfetti', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openGame(page, { hash: '#lektion-1' });
    await playLurd(page, lesson(1).sol);
    await expect(sign(page)).toHaveText('Geschafft! 9 Züge, kürzer geht es nicht.');
    await render(page, 8);
    const won = await pixels(page, FIELD);
    await settle(page);
    expect(won).toBe(await pixels(page, FIELD));
  });
});

test('ohne Test-Uhr läuft der Takt von selbst bis „Geschafft!“', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page, { hash: '#lektion-1', clock: false });
  const keys = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' } as const;
  let moves = 0;
  for (const ch of lesson(1).sol) {
    await page.keyboard.press(keys[ch.toLowerCase() as keyof typeof keys]);
    moves++;
    // Der Zähler steigt, sobald der Schritt beginnt: dann ist der vorige fertig und nichts wartet im Puffer
    await expect(count(page)).toHaveText(moves === 1 ? '1 Zug' : `${moves} Züge`);
  }
  await expect(sign(page)).toHaveText('Geschafft! 9 Züge, kürzer geht es nicht.');
  expect(errors).toEqual([]);
});

test.describe('Spielfeld im ganzen Bildschirm', () => {
  for (const [width, height, beside] of [
    [320, 640, false],
    [390, 844, false],
    [1280, 800, true],
    [844, 390, true],
  ] as const)
    test(`${width}×${height}: ohne Scrollen, Knöpfe ${beside ? 'neben' : 'unter'} dem Feld`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openGame(page, { hash: '#lektion-12', store: upTo(12) });
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - innerWidth,
        y: document.documentElement.scrollHeight - innerHeight,
      }));
      expect(overflow.x).toBeLessThanOrEqual(0);
      expect(overflow.y).toBeLessThanOrEqual(0);
      const field = await page.locator('#spiel .field').boundingBox();
      const acts = await page.locator('#spiel .gacts').boundingBox();
      expect(field && acts && (beside ? acts.x >= field.x + field.width : acts.y >= field.y + field.height)).toBe(true);
      // ganz im Bild (toBeInViewport genügt schon ein Teil)
      const inside = await page.evaluate(() =>
        ['#spiel [data-ks="undo"]', '#spiel [data-ks="sign"]'].map((sel) => {
          const r = document.querySelector(sel)!.getBoundingClientRect();
          return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
        }),
      );
      expect(inside).toEqual([true, true]);
    });

  test('quer (844×390): Knöpfe neben dem Feld; Drehen zeichnet das Feld neu', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openGame(page, { hash: '#lektion-1' });
    const field = await page.locator('#spiel .field').boundingBox();
    const acts = await page.locator('#spiel .gacts').boundingBox();
    expect(field && acts && acts.x >= field.x + field.width).toBe(true);
    const before = await page.locator(FIELD).evaluate((cv) => (cv as HTMLCanvasElement).style.width);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.locator(FIELD).evaluate((cv) => (cv as HTMLCanvasElement).style.width))
      .not.toBe(before);
  });
});
