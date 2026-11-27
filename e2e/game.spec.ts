// Spielen mit der Tastatur bis „Geschafft!“: Spielfeld, Zähler, Schild, Zug zurück, Neustart, Nochmal, Sackgassen und
// das Angebot zum Überspringen, Bestwert und „weiter“. Mit Test-Uhr: Jeder Schritt läuft erst, wenn der Test Bilder
// zeichnet (`render`, `playLurd`); gewartet wird nur auf Zustände (Text, Klassen, Attribute).
import { expect, test, type Page } from '@playwright/test';
import { LESSONS } from '../src/data/games/lessons';
import { CONFETTI_LIFE } from '../src/lib/games/sokoban/confetti';
import { SIGN } from '../src/data/games/texts';
import { ARROW_FILL } from '../src/data/games/kaje';
import {
  apart,
  box,
  colourCount,
  drawn,
  extras,
  fakeWakeLock,
  game,
  openGame,
  pixels,
  playLurd,
  render,
  spot,
  stored,
  wakeLog,
  watchErrors,
} from './helpers';

const FIELD = '#spiel canvas';
/** Rand einer festsitzenden Kiste (#e0442f, data/games/kaje.ts) */
const STUCK_RED = [0xe0, 0x44, 0x2f] as const;

const lesson = (n: number) => LESSONS[n - 1]!;
const spiel = (page: Page) => page.locator('ks-kistenschieber > section#spiel');
const sign = (page: Page) => page.locator('[data-ks="sign"]');
const count = (page: Page) => page.locator('[data-ks="count"]');
const dialog = (page: Page) => page.locator('#spiel dialog.menu');

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
  test('Lektion 1: Titel, Zähler, Feld, leeres Schild (Live-Region), Knöpfe; gemerkt als letzte; ohne Fehler', async ({
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
      name: 'Lektion 1: Erster Schubs. Antippen oder Pfeiltasten bewegen die Figur.',
    });
    await expect(field).toBeVisible();
    await expect(field).toHaveAttribute('tabindex', '0');
    expect(await drawn(page, FIELD)).toBe(true);
    // Keine Lektionshinweise: Das Schild ist zu Beginn leer, bleibt aber als Live-Region im Baum
    await expect(sign(page)).toHaveText('');
    await expect(sign(page)).toHaveAttribute('aria-live', 'polite');
    await expect(sign(page)).toHaveClass('sign');
    await expect(s.getByRole('button', { name: 'Zug zurück' })).toBeVisible();
    // Unten nur „Zug zurück“ und „Menü“ (beim Daumen, Issue #15); Tipp gibt es im Menü und mit H (Platz auf dem Handy)
    await expect(s.locator('.gacts .btn')).toHaveText(['Zug zurück', 'Menü']);
    await expect(s.getByRole('button', { name: 'Tipp' })).toHaveCount(0);
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
    await expect(sign(page)).toHaveText('');
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
    await expect(sign(page)).toHaveText('');
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
    await expect(sign(page)).toHaveText('');
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

  test('Lektion 15 vor dem 1. Dezember: Sieg mit dem Zusatz zur Einführung und „Zur Levelwahl“', async ({ page }) => {
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

  test('Lektion 3: eine Kiste auf dem Ziel braucht kein Schild', async ({ page }) => {
    await openGame(page, { hash: '#lektion-3', store: upTo(3) });
    await playLurd(page, 'uLdlUU');
    await expect(count(page)).toHaveText('6 Züge');
    await expect(sign(page)).toHaveText('');
    await expect(sign(page)).toHaveClass('sign');
  });

  for (const [width, height] of [
    [390, 844],
    [375, 560],
    [667, 375],
  ] as const)
    test(`${width}×${height}: Schild und Knöpfe nehmen dem Feld keinen Platz und liegen nie auf der Insel`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openGame(page, { hash: '#lektion-4', store: upTo(4) });
      const SIGN_SEL = '#spiel [data-ks="sign"]';
      const field = await box(page, '#spiel .field');
      const board = await box(page, FIELD);
      expect((await box(page, SIGN_SEL))?.height).toBe(0);
      await expect(sign(page)).not.toHaveCSS('display', 'none');
      // Kiste in die Ecke oben links (dort, wovor das Schild warnt), dann drei Rückschläge: das Angebot
      await playLurd(page, 'ruLLdlU');
      await expect(sign(page)).toHaveClass('sign warn');
      const warn = await box(page, SIGN_SEL);
      expect(warn!.height).toBeGreaterThan(20);
      await press(page, 'r');
      const offer = spiel(page).getByRole('button', { name: 'Zu knifflig? Überspringen' });
      await expect(offer).toBeVisible();
      for (const b of [warn, await box(page, SIGN_SEL), await offer.boundingBox()]) {
        expect(apart(b, board)).toBe(true);
        // hochkant im Himmel direkt über der Insel, quer daneben
        if (height > width) expect(b!.y + b!.height).toBeLessThanOrEqual(board!.y + 1);
        else expect(b!.x).toBeGreaterThanOrEqual(field!.x + field!.width);
      }
      expect(await box(page, '#spiel .field')).toEqual(field);
      expect(await box(page, FIELD)).toEqual(board);
      // Tippen geht durch die leere Fläche hindurch aufs Feld
      await expect(page.locator('#spiel .gmsg')).toHaveCSS('pointer-events', 'none');
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

  test('Rahmen ums Feld nur nach Tab, nicht nach Klick und Pfeiltasten (#8)', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    const field = page.locator(FIELD);
    const outline = () => field.evaluate((cv) => getComputedStyle(cv).outlineStyle);
    await field.click();
    await press(page, 'ArrowRight');
    await expect(field).toBeFocused();
    expect(await outline()).toBe('none');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(field).toBeFocused();
    expect(await outline()).toBe('solid');
    await press(page, 'ArrowLeft');
    expect(await outline()).toBe('none');
  });
});

test.describe('Konfetti', () => {
  // Die Teilchen sind klein und schattiert, ihre Farben daher kaum genau zu zählen. Verglichen wird das ganze Feld:
  // nach dem Sieg (ohne Konfetti) steht es still, jedes Bild gleicht dem, wenn alle Teilchen verglüht sind.
  /** So lange zeichnen, bis jedes Teilchen sicher verglüht ist */
  const settle = (page: Page) => render(page, Math.ceil((CONFETTI_LIFE + 200) / 16), 16);

  test('nach dem Sieg fliegt Konfetti, das von selbst verglüht', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await extras(page);
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
    await extras(page);
    await playLurd(page, lesson(1).sol);
    await render(page, 8);
    await press(page, 'z');
    const afterUndo = await pixels(page, FIELD);
    await settle(page);
    expect(afterUndo).toBe(await pixels(page, FIELD));
  });

  test('Sieg, bevor der nachgeladene Teil da ist: das Konfetti kommt mit ihm', async ({ page }) => {
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route(/\/ks-menu\.[^/]*\.js$/, async (route) => {
      await held;
      await route.continue();
    });
    await openGame(page, { hash: '#lektion-1' });
    await playLurd(page, lesson(1).sol);
    await expect(sign(page)).toHaveText('Geschafft! 9 Züge, kürzer geht es nicht.');
    await expect(spiel(page)).not.toHaveClass(/\bextras\b/);
    await render(page, 8);
    const before = await pixels(page, FIELD);
    release();
    await extras(page);
    await render(page, 8);
    expect(await pixels(page, FIELD)).not.toBe(before);
    await settle(page);
    expect(await pixels(page, FIELD)).toBe(before);
  });

  test('bei reduzierter Bewegung kein Konfetti', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openGame(page, { hash: '#lektion-1' });
    await extras(page);
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

test.describe('Menü', () => {
  test('M öffnet es: Titel, acht Einträge und die Notiz; Esc schließt; „Weiterspielen“ fokussiert das Feld', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openGame(page, { hash: '#lektion-1' });
    await page.keyboard.press('m');
    const d = page.getByRole('dialog', { name: 'Lektion 1: Erster Schubs' });
    await expect(d).toBeVisible();
    await expect(d).toHaveAttribute('aria-labelledby', 'menu-title');
    await expect(d.getByRole('heading', { level: 2 })).toHaveText('Lektion 1: Erster Schubs');
    const entries = d.locator('button, a');
    await expect(entries).toHaveText([
      'Weiterspielen',
      'Neu starten',
      'Tipp',
      'Lösung zeigen',
      'Lektion überspringen',
      'Level wählen',
      'Einstellungen',
      'Startbildschirm',
    ]);
    await expect(d.getByRole('link')).toHaveCount(3);
    await expect(d.getByRole('link', { name: 'Level wählen' })).toHaveAttribute('href', '#level');
    await expect(d.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute('href', '#einstellungen');
    await expect(d.getByRole('link', { name: 'Startbildschirm' })).toHaveAttribute('href', '#start');
    await expect(d.locator('p.note')).toHaveText(
      'Überspringen und „Lösung zeigen“ machen die nächste Lektion frei. Zurückkommen geht jederzeit über „Level wählen“.',
    );
    await expect(d.getByRole('button', { name: 'Weiterspielen' })).toHaveClass(/\bprimary\b/);
    await page.keyboard.press('Escape');
    await expect(d).toBeHidden();
    await page.getByRole('button', { name: 'Menü' }).click();
    await expect(d).toBeVisible();
    await d.getByRole('button', { name: 'Weiterspielen' }).click();
    await expect(d).toBeHidden();
    await expect(page.locator(FIELD)).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('Esc öffnet es, der Fokus bleibt darin gefangen, Tasten fürs Spiel zählen nicht', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const outside = await page.evaluate(() => {
        const a = document.activeElement;
        return !!a && a !== document.body && !a.closest('dialog');
      });
      expect(outside).toBe(false);
    }
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('z');
    await render(page, 4);
    await expect(count(page)).toHaveText('0 Züge');
    await expect(dialog(page)).toBeVisible();
  });

  test('Esc hebt erst die Auswahl (Tipp) auf, das nächste Esc öffnet das Menü', async ({ page }) => {
    await openGame(page, { hash: '#lektion-2', store: { 'skip.e1': true } });
    const turquoise = [0x2e, 0xc4, 0xb6] as const;
    await page.keyboard.press('h');
    await render(page);
    expect(await colourCount(page, FIELD, turquoise)).toBeGreaterThan(50);
    await page.keyboard.press('Escape');
    await render(page);
    expect(await colourCount(page, FIELD, turquoise)).toBe(0);
    await expect(dialog(page)).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeVisible();
  });

  test('ein Bildschirmwechsel schließt das Menü; „Level wählen“ führt zur Levelwahl', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await page.keyboard.press('m');
    await expect(dialog(page)).toBeVisible();
    await page.evaluate(() => (location.hash = '#start'));
    await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await page.evaluate(() => (location.hash = '#lektion-1'));
    await page.keyboard.press('m');
    await dialog(page).getByRole('link', { name: 'Level wählen' }).click();
    await expect(page).toHaveURL(/#level$/);
    await expect(dialog(page)).toBeHidden();
  });

  test('„Neu starten“ im Menü startet neu (zurücknehmbar)', async ({ page }) => {
    await openGame(page, { hash: '#lektion-1' });
    await press(page, 'ArrowLeft');
    await page.keyboard.press('m');
    await dialog(page).getByRole('button', { name: 'Neu starten' }).click();
    await render(page);
    await expect(count(page)).toHaveText('0 Züge');
    await expect(sign(page)).toHaveText(SIGN.restarted);
  });
});

test.describe('Tipp und Lösung', () => {
  const turquoise = [0x2e, 0xc4, 0xb6] as const;

  test('Tipp (Menü) am Start von Lektion 2: Kiste gewählt, türkiser Pfeil, Tipp-Text', async ({ page }) => {
    await openGame(page, { hash: '#lektion-2', store: { 'skip.e1': true } });
    expect(await colourCount(page, FIELD, turquoise)).toBe(0);
    await page.keyboard.press('m');
    await dialog(page).getByRole('button', { name: 'Tipp' }).click();
    await expect(dialog(page)).toBeHidden();
    await render(page);
    await expect(sign(page)).toHaveText(SIGN.tip);
    // türkiser Pfeil (Tipp) und goldener Rand der gewählten Kiste
    expect(await colourCount(page, FIELD, turquoise)).toBeGreaterThan(50);
    expect(await colourCount(page, FIELD, [0xf0, 0xa5, 0x31])).toBeGreaterThan(20);
    expect(ARROW_FILL.hint).toBe('#2ec4b6');
  });

  test('Tipp am Start von Lektion 6 (Issue #14): nur der türkise Pfeil, kein grauer an die Wand', async ({ page }) => {
    await openGame(page, { hash: '#lektion-6', store: upTo(6) });
    const grey = [0xa3, 0xaa, 0xb3] as const;
    expect(ARROW_FILL.dead).toBe('#a3aab3');
    const before = await colourCount(page, FIELD, grey);
    // Von Hand gewählt: hoch (grau, an die Wand) und runter (gold)
    const box = await spot(page, { crate: 0 });
    await page.mouse.click(box.x, box.y);
    await render(page);
    expect(await colourCount(page, FIELD, grey)).toBeGreaterThan(before + 50);
    await page.keyboard.press('Escape');
    await page.keyboard.press('h');
    await render(page);
    await expect(sign(page)).toHaveText(SIGN.tip);
    expect(await colourCount(page, FIELD, turquoise)).toBeGreaterThan(50);
    const withTip = await colourCount(page, FIELD, grey);
    // Esc nimmt den Tipp weg, das Schild bleibt (gleiche Größe des Felds): Grau ändert sich kaum, es gab keinen grauen
    // Pfeil (der brächte über 50 Pixel; der große Tipp-Pfeil verdeckt nur einzelne graue Pixel des Felds)
    await page.keyboard.press('Escape');
    await render(page);
    await expect(sign(page)).toHaveText(SIGN.tip);
    expect(await colourCount(page, FIELD, turquoise)).toBe(0);
    expect(Math.abs((await colourCount(page, FIELD, grey)) - withTip)).toBeLessThan(10);
  });

  test('Tipp aus der Sackgasse (H): „Von hier aus geht es nicht mehr. …“ als Warnung', async ({ page }) => {
    await openGame(page, { hash: '#lektion-4', store: upTo(4) });
    await playLurd(page, 'ruLLdlU');
    await page.keyboard.press('h');
    await expect(sign(page)).toHaveText(SIGN.tipDead);
    await expect(sign(page)).toHaveClass('sign warn');
  });

  test('„Lösung zeigen“ merkt shown.e2 sofort und spielt bis „So geht es. Jetzt du? …“, ohne Bestwert', async ({
    page,
  }) => {
    await openGame(page, { hash: '#lektion-2', store: { 'skip.e1': true } });
    await page.keyboard.press('m');
    await spiel(page).getByRole('button', { name: 'Lösung zeigen' }).click();
    expect(await stored(page, 'shown.e2')).toBe('true');
    await expect(sign(page)).toHaveText(SIGN.showing);
    await render(page, 60);
    await expect(sign(page)).toHaveText(SIGN.shownWin);
    await expect(sign(page)).toHaveClass('sign win');
    await expect(count(page)).toHaveText(`${lesson(2).moves} Züge`);
    expect(await stored(page, 'best.e2')).toBeNull();
    await expect(spiel(page).getByRole('button', { name: 'Nochmal' })).toBeVisible();
  });

  test('ein Tastendruck beendet das Vorspielen', async ({ page }) => {
    await openGame(page, { hash: '#lektion-2', store: { 'skip.e1': true } });
    await page.keyboard.press('m');
    await spiel(page).getByRole('button', { name: 'Lösung zeigen' }).click();
    await render(page, 4);
    await page.keyboard.press('x');
    await expect(sign(page)).toHaveText('');
    const moves = await count(page).textContent();
    await render(page, 40);
    await expect(count(page)).toHaveText(moves!);
    await expect(sign(page)).toHaveText('');
  });

  test('das Menü zu öffnen beendet das Vorspielen', async ({ page }) => {
    await openGame(page, { hash: '#lektion-2', store: { 'skip.e1': true } });
    await page.keyboard.press('m');
    await spiel(page).getByRole('button', { name: 'Lösung zeigen' }).click();
    await render(page, 4);
    await page.keyboard.press('m');
    await expect(page.locator('#spiel dialog.menu')).toBeVisible();
    await expect(sign(page)).toHaveText('');
    await page.keyboard.press('Escape');
    await expect(page.locator('#spiel dialog.menu')).toBeHidden();
    const moves = await count(page).textContent();
    await render(page, 40);
    await expect(count(page)).toHaveText(moves!);
  });
});

test.describe('Lektion überspringen', () => {
  const skipVia = async (page: Page) => {
    await page.keyboard.press('m');
    await spiel(page).getByRole('button', { name: 'Lektion überspringen' }).click();
  };

  test('Lektion 3: merkt skip.e3 und öffnet Lektion 4', async ({ page }) => {
    await openGame(page, { hash: '#lektion-3', store: upTo(3) });
    await skipVia(page);
    await expect(page).toHaveURL(/#lektion-4$/);
    expect(await stored(page, 'skip.e3')).toBe('true');
    await expect(spiel(page).getByRole('heading', { level: 2, name: 'Lektion 4: Ecken sind Fallen' })).toBeVisible();
  });

  test('mit Bestwert in Lektion 3 kein skip.e3', async ({ page }) => {
    await openGame(page, { hash: '#lektion-3', store: { ...upTo(3), 'best.e3': { moves: 14, pushes: 6 } } });
    await skipVia(page);
    await expect(page).toHaveURL(/#lektion-4$/);
    expect(await stored(page, 'skip.e3')).toBeNull();
  });

  test('Lektion 15 führt zur Levelwahl', async ({ page }) => {
    await openGame(page, { hash: '#lektion-15', store: upTo(15) });
    await skipVia(page);
    await expect(page).toHaveURL(/#level$/);
    expect(await stored(page, 'skip.e15')).toBe('true');
  });
});

test.describe('nachgeladen und Wake Lock', () => {
  test('ohne den nachgeladenen Teil geht das Menü trotzdem: Lösung zeigen und Level wählen', async ({ page }) => {
    await page.route(/\/ks-menu\.[^/]*\.js$/, (route) => route.abort());
    await openGame(page, { hash: '#lektion-2', store: { 'skip.e1': true } });
    await page.keyboard.press('m');
    const d = page.locator('#spiel dialog.menu');
    await expect(d).toBeVisible();
    await d.getByRole('button', { name: 'Lösung zeigen' }).click();
    await expect(d).toBeHidden();
    expect(await stored(page, 'shown.e2')).toBe('true');
    await expect(sign(page)).toHaveText(SIGN.showing);
    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();
    await d.getByRole('link', { name: 'Level wählen' }).click();
    await expect(page).toHaveURL(/#level$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Level wählen' })).toBeVisible();
    await expect(spiel(page)).not.toHaveClass(/\bextras\b/);
  });

  test('das Konfetti (Teil ks-menu) kommt erst mit einer Lektion', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (r) => {
      if (/\/ks-menu\.[^/]*\.js$/.test(r.url())) asked.push(r.url());
    });
    await openGame(page);
    await page.evaluate(() => (location.hash = '#level'));
    await expect(page.getByRole('heading', { level: 2, name: 'Level wählen' })).toBeVisible();
    expect(asked).toEqual([]);
    await page.evaluate(() => (location.hash = '#lektion-1'));
    await extras(page);
    expect(asked).toHaveLength(1);
  });

  test('Wake Lock: angefordert auf dem Spielfeld, freigegeben beim Verlassen', async ({ page }) => {
    await fakeWakeLock(page);
    await openGame(page);
    expect(await wakeLog(page)).toEqual([]);
    await page.evaluate(() => (location.hash = '#lektion-1'));
    await expect.poll(() => wakeLog(page)).toEqual(['request screen']);
    await page.evaluate(() => (location.hash = '#level'));
    await expect.poll(() => wakeLog(page)).toEqual(['request screen', 'release']);
  });

  test('Wake Lock: wieder sichtbar fordert neu an', async ({ page }) => {
    await fakeWakeLock(page);
    await openGame(page, { hash: '#lektion-1' });
    await expect.poll(() => wakeLog(page)).toEqual(['request screen']);
    const setVisibility = (state: string) =>
      page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await setVisibility('hidden');
    await setVisibility('visible');
    await expect.poll(() => wakeLog(page)).toEqual(['request screen', 'release', 'request screen']);
  });
});
