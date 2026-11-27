// Level 1 bis 6 als Adventskalender (Issue #22): Level N geht am N. Dezember 2026 um 0 Uhr deutscher Zeit auf. Die
// Test-Uhr stellt das Datum (`openGame(page, { date })`), damit die Tests nicht vom Tag abhängen, an dem sie laufen.
// Gewartet wird nur auf Zustände; gespielt mit `playLurd` und der Test-Uhr.
import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../src/data/games/levels';
import { LESSONS } from '../src/data/games/lessons';
import { game, openGame, playLurd, render, stored, violations, watchErrors } from './helpers';

/** Mitternacht in Berlin am 1. Dezember, als UTC */
const DEC1 = '2026-11-30T23:00:00Z';
const DEC3 = '2026-12-03T10:00:00+01:00';

const level = (n: number) => LEVELS[n - 1]!;
const screen = (page: Page, id: string) => page.locator(`ks-kistenschieber > section#${id}`);
const levels = (page: Page) => page.locator('#start [data-ks="levels"]');
const intro = (page: Page) => page.locator('#start [data-ks="intro"]');
const sign = (page: Page) => page.locator('[data-ks="sign"]');
const dialog = (page: Page) => page.locator('#spiel dialog.menu');

/** Die ganze Einführung geschafft */
const introDone = (): Record<string, unknown> =>
  Object.fromEntries(LESSONS.map((l) => [`best.e${l.n}`, { moves: l.moves, pushes: l.pushes }]));

test.describe('vor dem 1. Dezember', () => {
  test('Start: Level als Ankündigung ohne Knopf; #level-1 ist noch zu und führt zur Einführung', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { date: '2026-11-30T23:59:59+01:00' });
    await expect(screen(page, 'start').getByRole('heading', { level: 2, name: 'Level ab 1. Dezember' })).toBeVisible();
    await expect(levels(page)).toHaveClass(/\bsoon\b/);
    await expect(levels(page).getByRole('link')).toHaveCount(0);

    await page.evaluate(() => (location.hash = '#level-1'));
    const locked = screen(page, 'gesperrt');
    await expect(page.getByRole('heading', { level: 2, name: 'Dieses Level ist noch zu' })).toBeVisible();
    await expect(locked.locator('#locked-which')).toHaveText('Level 1: Anleger noch zu');
    await expect(locked.getByText('Level 1: Anleger geht am 1. Dezember auf.')).toBeVisible();
    await expect(locked.getByRole('link', { name: 'Zu Lektion 1' })).toHaveAttribute('href', '#lektion-1');
    await expect(
      locked.getByText('Jeden Tag im Advent geht ein neues Level auf. Gespielt wird der Reihe nach.'),
    ).toBeVisible();
    await expect(page).toHaveTitle('Level 1 · Kistenschieber');
    expect(await stored(page, 'last.l')).toBeNull();
    expect(errors).toEqual([]);
  });

  test('Levelwahl: jede Levelkarte sagt, wann sie aufgeht', async ({ page }) => {
    await openGame(page, { hash: '#level' });
    for (const l of LEVELS) {
      const card = page.locator(`#${l.id}`);
      await expect(card).toHaveClass(/\blocked\b/);
      await expect(card.locator('.badge')).toHaveText(`Geht am ${l.n}. Dezember auf`);
    }
  });
});

test.describe('Adventskalender', () => {
  test('am 1. Dezember um 0 Uhr deutscher Zeit geht Level 1 auf, Level 2 noch nicht', async ({ page }) => {
    await openGame(page, { date: DEC1 });
    await expect(screen(page, 'start').getByRole('heading', { level: 2, name: 'Level Adventskalender' })).toBeVisible();
    await expect(levels(page)).toHaveClass(/\bnow\b/);
    await expect(levels(page).getByText('0 von 1 Level geschafft. Level 2 geht am 2. Dezember auf.')).toBeVisible();
    const go = levels(page).getByRole('link', { name: 'Level 1 spielen' });
    await expect(go).toHaveAttribute('href', '#level-1');
    // Gold bleibt bei der Einführung, solange sie nicht geschafft ist
    await expect(go).not.toHaveClass(/\bprimary\b/);
    await expect(screen(page, 'start').locator('.btn.primary')).toHaveCount(1);
    await expect(intro(page).locator('.btn.primary')).toHaveText('Spielen');

    await page.evaluate(() => (location.hash = '#level'));
    await expect(page.locator('#level-1')).toHaveClass(/\bopen\b/);
    await expect(page.locator('#level-1')).toHaveClass(/\bcur\b/);
    await expect(page.locator('#level-2 .badge')).toHaveText('Geht am 2. Dezember auf');
  });

  test('Level 1 spielen: Titel, Sieg mit Bestwert unter best.l1, danach zur Levelwahl (Level 2 ist noch zu)', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openGame(page, { hash: '#level-1', date: DEC1 });
    await expect(screen(page, 'spiel')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Level 1: Anleger' })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Level 1: Anleger\. / })).toBeVisible();
    expect(await stored(page, 'last.l')).toBe('"l1"');
    expect(await stored(page, 'last')).toBeNull();
    const l = level(1);
    await playLurd(page, l.sol);
    await expect(sign(page)).toHaveText(`Geschafft! ${l.moves} Züge, kürzer geht es nicht.`);
    expect(await stored(page, 'best.l1')).toBe(JSON.stringify({ moves: l.moves, pushes: l.pushes }));
    expect(await stored(page, 'best.e1')).toBeNull();
    const next = screen(page, 'spiel').getByRole('link', { name: 'Zur Levelwahl' });
    await expect(next).toHaveAttribute('href', '#level');
    await next.click();
    await expect(page.locator('#level-1 .badge')).toHaveText(`Geschafft, Bestwert ${l.moves} Züge`);
    await expect(page.locator('#level-2')).toHaveClass(/\blocked\b/);
    expect(errors).toEqual([]);
  });

  test('am 3. Dezember: nach Level 1 „Weiter zu Level 2“, Level 3 erst nach Level 2', async ({ page }) => {
    await openGame(page, { hash: '#level-1', date: DEC3 });
    await playLurd(page, level(1).sol);
    const next = screen(page, 'spiel').getByRole('link', { name: 'Weiter zu Level 2' });
    await expect(next).toHaveAttribute('href', '#level-2');
    await page.evaluate(() => (location.hash = '#level-3'));
    const locked = screen(page, 'gesperrt');
    await expect(
      locked.getByText('Schaff zuerst Level 2: Poller oder überspring es; dann geht es weiter.'),
    ).toBeVisible();
    await expect(locked.getByRole('link', { name: 'Zu Level 2' })).toHaveAttribute('href', '#level-2');
    await page.evaluate(() => (location.hash = '#level-4'));
    await expect(locked.getByText('Level 4: Taurolle geht am 4. Dezember auf.')).toBeVisible();
  });

  test('Menü im Level: „Level überspringen“ merkt skip.l2 und öffnet Level 3', async ({ page }) => {
    await openGame(page, { hash: '#level-2', date: DEC3, store: { 'best.l1': { moves: 25, pushes: 10 } } });
    await page.getByRole('button', { name: 'Menü' }).click();
    const d = dialog(page);
    await expect(d.getByRole('heading', { name: 'Level 2: Poller' })).toBeVisible();
    await expect(
      d.getByText(
        'Überspringen und „Lösung zeigen“ machen das nächste Level frei. Zurückkommen geht jederzeit über „Level wählen“.',
      ),
    ).toBeVisible();
    await d.getByRole('button', { name: 'Level überspringen' }).click();
    await expect(page).toHaveURL(/#level-3$/);
    expect(await stored(page, 'skip.l2')).toBe('true');
    expect(await stored(page, 'skip.e2')).toBeNull();
    await expect(page.getByRole('heading', { level: 2, name: 'Level 3: Laufsteg' })).toBeVisible();
  });

  test('„Lösung zeigen“ im Level: „… startet das Level neu.“, gemerkt als shown.l1', async ({ page }) => {
    await openGame(page, { hash: '#level-1', date: DEC1 });
    await page.getByRole('button', { name: 'Menü' }).click();
    await dialog(page).getByRole('button', { name: 'Lösung zeigen' }).click();
    expect(await stored(page, 'shown.l1')).toBe('true');
    await render(page, 400, 200);
    await expect(sign(page)).toHaveText('So geht es. Jetzt du? „Nochmal“ startet das Level neu.');
    expect(await stored(page, 'best.l1')).toBeNull();
  });

  test('Einführung geschafft: der Knopf der Level trägt Gold, „Zurück zum Spiel“ führt ins Level', async ({ page }) => {
    await openGame(page, {
      date: DEC3,
      store: { ...introDone(), 'best.l1': { moves: 25, pushes: 10 }, 'last.l': 'l2' },
    });
    const go = levels(page).getByRole('link', { name: 'Weiterspielen: Level 2' });
    await expect(go).toHaveAttribute('href', '#level-2');
    await expect(go).toHaveClass(/\bprimary\b/);
    await expect(intro(page).getByRole('link', { name: 'Einführung wiederholen' })).not.toHaveClass(/\bprimary\b/);
    await expect(screen(page, 'start').locator('.btn.primary')).toHaveCount(1);
    await expect(levels(page).getByText('1 von 3 Leveln geschafft. Level 4 geht am 4. Dezember auf.')).toBeVisible();

    await go.click();
    await expect(page.getByRole('heading', { level: 2, name: 'Level 2: Poller' })).toBeVisible();
    await page.evaluate(() => (location.hash = '#einstellungen'));
    await expect(page.getByRole('link', { name: 'Zurück zum Spiel' })).toHaveAttribute('href', '#level-2');
  });

  test('alle offenen Level erledigt: kein Knopf, aber wann das nächste aufgeht', async ({ page }) => {
    await openGame(page, {
      date: DEC3,
      store: { 'best.l1': { moves: 25, pushes: 10 }, 'skip.l2': true, 'shown.l3': true },
    });
    await expect(levels(page).getByText('1 von 3 Leveln geschafft. Level 4 geht am 4. Dezember auf.')).toBeVisible();
    await expect(levels(page).getByRole('link')).toHaveCount(0);
  });

  test('nach Lektion 15 am 1. Dezember: „Weiter zu Level 1“', async ({ page }) => {
    const store: Record<string, unknown> = {};
    for (let k = 1; k < 15; k++) store[`skip.e${k}`] = true;
    await openGame(page, { hash: '#lektion-15', date: DEC1, store });
    await playLurd(page, LESSONS[14]!.sol);
    const next = screen(page, 'spiel').getByRole('link', { name: 'Weiter zu Level 1' });
    await expect(next).toHaveAttribute('href', '#level-1');
    await next.click();
    await expect(page.getByRole('heading', { level: 2, name: 'Level 1: Anleger' })).toBeVisible();
    await expect(game(page)).toHaveClass(/\bplaying\b/);
  });

  test('ab dem 6. Dezember sind alle sechs offen; nach Level 6 „Weitere Level folgen.“', async ({ page }) => {
    const store: Record<string, unknown> = {};
    for (const l of LEVELS) store[`best.l${l.n}`] = { moves: l.moves, pushes: l.pushes };
    await openGame(page, { date: '2026-12-24T18:00:00+01:00', store });
    await expect(levels(page).getByText('6 von 6 Leveln geschafft. Weitere Level folgen.')).toBeVisible();
  });
});

test.describe('Barrierefrei', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  for (const colorScheme of ['light', 'dark'] as const)
    test(`Start, Levelwahl und gesperrtes Level im Advent (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openGame(page, { date: DEC3, store: { ...introDone(), 'best.l1': { moves: 25, pushes: 10 } } });
      await expect(levels(page).getByRole('link', { name: 'Weiterspielen: Level 2' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.evaluate(() => (location.hash = '#level'));
      await expect(page.locator('#level-4 .badge')).toHaveText('Geht am 4. Dezember auf');
      expect(await violations(page)).toEqual([]);
      await page.evaluate(() => (location.hash = '#level-4'));
      await expect(page.getByRole('heading', { level: 2, name: 'Dieses Level ist noch zu' })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
});

// Wie die Einführung: Handy hoch und quer passt der ganze Start ohne Scrollen, auch mit dem Knopf der Level
for (const [width, height] of [
  [390, 844],
  [844, 390],
  [667, 375],
] as const)
  test(`${width}×${height} im Advent: Einführung, Level mit Knopf und Nebenknöpfe ohne Scrollen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openGame(page, { date: DEC3 });
    const go = await levels(page).getByRole('link', { name: 'Level 1 spielen' }).boundingBox();
    const btns = await screen(page, 'start').locator('.startbtns').boundingBox();
    expect(go && go.y + go.height).toBeLessThanOrEqual(height);
    expect(btns && btns.y + btns.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
  });
