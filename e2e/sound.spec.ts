// Ton (Issue #9): Ein vorgetäuschter AudioContext (`fakeAudio`) zählt die gespielten Töne samt Frequenz. Welche Töne
// zu welchem Zustandswechsel gehören, prüft ks-sound.test.ts; hier geht es um die Verdrahtung: erst nach einer Geste,
// Schieben, Einrasten und „Geschafft!“ klingen, „Ton: Aus“ bleibt still, verborgen schläft der Ton.
import { expect, test, type Page } from '@playwright/test';
import { SOUNDS } from '../src/scripts/games/ks-sound';
import { SIGN } from '../src/data/games/texts';
import { audioLog, fakeAudio, openGame, render, stored } from './helpers';

const sign = (page: Page) => page.locator('[data-ks="sign"]');
const spiel = (page: Page) => page.locator('ks-kistenschieber > section#spiel');

/** Frequenzen eines Tons aus ks-sound.ts (Rauschen als `noise`) */
const freqs = (id: keyof typeof SOUNDS) => SOUNDS[id].map(([f, , wave]) => (wave === 'noise' ? 'noise' : f));
/** n-mal derselbe Ton */
const times = (n: number, id: keyof typeof SOUNDS) => Array.from({ length: n }, () => freqs(id)).flat();

/** Eine Taste wirklich drücken (eine Geste) und den Schritt zu Ende zeichnen */
async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await render(page, 4);
}

/** Die Lösung von Lektion 1 (rruulLLLL) mit echten Tasten */
const LESSON1 = ['ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft'];

test.beforeEach(async ({ page }) => {
  await fakeAudio(page);
});

test('vor der ersten Geste kein AudioContext; dann Schritte, Schieben, Einrasten und „Geschafft!“', async ({
  page,
}) => {
  await openGame(page, { hash: '#lektion-1' });
  await render(page, 4);
  expect(await audioLog(page)).toEqual({ contexts: 0, state: 'none', notes: [] });

  for (const key of LESSON1) await press(page, key);
  let log = await audioLog(page);
  expect(log.contexts).toBe(1);
  expect(log.notes).toEqual([...times(5, 'step'), ...times(3, 'push')]);

  await press(page, 'ArrowLeft');
  await expect(sign(page)).toHaveText('Geschafft! 9 Züge, kürzer geht es nicht.');
  log = await audioLog(page);
  expect(log.notes).toEqual([...times(5, 'step'), ...times(4, 'push'), ...freqs('lock'), ...freqs('win')]);
  expect(log.contexts).toBe(1);
});

test('Zug zurück bleibt still', async ({ page }) => {
  await openGame(page, { hash: '#lektion-1' });
  await press(page, 'ArrowRight');
  const before = (await audioLog(page)).notes.length;
  await press(page, 'z');
  await press(page, 'Backspace');
  expect((await audioLog(page)).notes.length).toBe(before);
});

test('„Ton: Aus“ ist still und legt keinen AudioContext an', async ({ page }) => {
  await openGame(page, { hash: '#lektion-1', store: { ton: 'aus' } });
  for (const key of [...LESSON1, 'ArrowLeft']) await press(page, key);
  await expect(sign(page)).toHaveText('Geschafft! 9 Züge, kürzer geht es nicht.');
  expect(await audioLog(page)).toEqual({ contexts: 0, state: 'none', notes: [] });
});

test('Einstellungen: „Ton“ auch ohne Touch, „Aus“ wird gemerkt und schaltet stumm, „An“ weckt den Ton', async ({
  page,
}) => {
  await openGame(page, { hash: '#einstellungen' });
  const group = page.getByRole('group', { name: 'Ton' });
  await expect(page.getByRole('heading', { level: 2, name: 'Ton' })).toBeVisible();
  const on = group.getByRole('button', { name: 'An' });
  const off = group.getByRole('button', { name: 'Aus' });
  await expect(on).toHaveAttribute('aria-pressed', 'true');
  await expect(off).toHaveAttribute('aria-pressed', 'false');
  await off.click();
  await expect(off).toHaveAttribute('aria-pressed', 'true');
  await expect(on).toHaveAttribute('aria-pressed', 'false');
  expect(await stored(page, 'ton')).toBe('"aus"');
  // Das Drücken auf „Aus“ war noch eine Geste mit Ton an; danach schläft er
  expect(await audioLog(page)).toMatchObject({ state: 'suspended', notes: [] });

  await page.evaluate(() => (location.hash = '#lektion-1'));
  await expect(spiel(page)).toBeVisible();
  for (const key of [...LESSON1, 'ArrowLeft']) await press(page, key);
  expect((await audioLog(page)).notes).toEqual([]);

  await page.evaluate(() => (location.hash = '#einstellungen'));
  await on.click();
  expect(await stored(page, 'ton')).toBe('"an"');
  expect(await audioLog(page)).toMatchObject({ contexts: 1, state: 'running', notes: [] });
  await page.evaluate(() => (location.hash = '#lektion-1'));
  await expect(spiel(page)).toBeVisible();
  await press(page, 'ArrowRight');
  expect((await audioLog(page)).notes).toEqual(freqs('step'));
});

test('verborgen schläft der Ton, die nächste Geste weckt ihn', async ({ page }) => {
  await openGame(page, { hash: '#lektion-1' });
  await press(page, 'ArrowRight');
  expect((await audioLog(page)).state).toBe('running');
  const setVisibility = (state: string) =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  expect((await audioLog(page)).state).toBe('suspended');
  await setVisibility('visible');
  expect((await audioLog(page)).state).toBe('suspended');
  await press(page, 'ArrowRight');
  expect(await audioLog(page)).toMatchObject({ contexts: 1, state: 'running' });
});

test('„Lösung zeigen“ bleibt ruhig: nur Einrasten und Melodie', async ({ page }) => {
  await openGame(page, { hash: '#lektion-2', store: { 'skip.e1': true } });
  await page.keyboard.press('m');
  await spiel(page).getByRole('button', { name: 'Lösung zeigen' }).click();
  await render(page, 60);
  await expect(sign(page)).toHaveText(SIGN.shownWin);
  expect((await audioLog(page)).notes).toEqual([...freqs('lock'), ...freqs('win')]);
});
