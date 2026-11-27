// Die Spielseite ohne Spielfeld (das prüft e2e/game.spec.ts): Startbildschirm, Einstellungen, Bildschirme per Hash und ohne JavaScript, dazu die
// 404-Seite. Ohne Fehler in der Konsole, ohne seitliches Scrollen, nicht im Suchindex.
import { expect, test, type Page } from '@playwright/test';
import { LESSONS } from '../src/data/games/lessons';
import { drawn, game, gotoGame, openGame, pixels, reloadGame, stored, violations, watchErrors } from './helpers';

const HOME = 'https://www.mitwachsen-spiele.de/';
const START = '#start canvas';
const PREVIEW = '#einstellungen canvas';

const screen = (page: Page, id: string) => page.locator(`ks-kistenschieber > section#${id}`);

test.describe('Startbildschirm', () => {
  test('zeigt Titel, Knöpfe und die gezeichnete erste Lektion, ohne Fehler', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
    await expect(page.getByText('Einführung: 0 von 15 Lektionen geschafft')).toBeVisible();
    const start = screen(page, 'start');
    await expect(start.getByRole('link', { name: 'Spielen', exact: true })).toHaveAttribute('href', '#lektion-1');
    await expect(start.getByRole('link', { name: 'Level wählen' })).toHaveAttribute('href', '#level');
    await expect(start.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute('href', '#einstellungen');
    await expect(page.getByRole('img', { name: 'Lektion 1: Erster Schubs als Bild' })).toBeVisible();
    expect(await drawn(page, START)).toBe(true);
    await expect(page).toHaveTitle('Kistenschieber');
    await expect(screen(page, 'level')).toBeHidden();
    await expect(screen(page, 'einstellungen')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('mit Bestwert in Lektion 1: „Weiterspielen: Lektion 2“, auch „Zurück zum Spiel“ führt dorthin', async ({
    page,
  }) => {
    await openGame(page, { store: { 'best.e1': { moves: 9, pushes: 4 } } });
    const go = page.getByRole('link', { name: 'Weiterspielen: Lektion 2' });
    await expect(go).toHaveAttribute('href', '#lektion-2');
    await expect(page.getByText('Einführung: 1 von 15 Lektionen geschafft')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Lektion 2: Um die Ecke als Bild' })).toBeVisible();
    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page.getByRole('link', { name: 'Zurück zum Spiel' })).toHaveAttribute('href', '#lektion-2');
  });

  test('„Spielen“, solange nichts angefangen ist, auch mit einer gesperrten letzten Lektion', async ({ page }) => {
    await openGame(page, { store: { last: 'e7' } });
    await expect(page.getByRole('link', { name: 'Spielen', exact: true })).toHaveAttribute('href', '#lektion-1');
  });

  test('nach der Einführung: „Einführung geschafft. Die Level kommen bald.“', async ({ page }) => {
    const store: Record<string, unknown> = {};
    for (let n = 1; n <= 15; n++) store[`skip.e${n}`] = true;
    await openGame(page, { store });
    await expect(page.getByText('Einführung geschafft. Die Level kommen bald.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Weiterspielen: Lektion 15' })).toHaveAttribute('href', '#lektion-15');
  });
});

test.describe('Einstellungen', () => {
  test('Drehung auf 30: gespeichert, Anzeige 30°, Vorschau neu; Zurücksetzen; neu laden behält', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { hash: '#einstellungen' });
    await expect(page.getByRole('heading', { level: 2, name: 'Einstellungen' })).toBeVisible();
    await expect(page.getByText('Nur das Nötigste: der Blickwinkel')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Ansicht' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Startbildschirm' })).toHaveAttribute('href', '#start');
    await expect(page.getByRole('link', { name: 'Zurück zum Spiel' })).toHaveAttribute('href', '#lektion-1');
    await expect(page.getByRole('img', { name: 'Vorschau der Ansicht' })).toBeVisible();
    expect(await drawn(page, PREVIEW)).toBe(true);
    const yaw = page.getByLabel('Drehung');
    const tilt = page.getByLabel('Neigung');
    const before = await pixels(page, PREVIEW);
    await yaw.fill('30');
    expect(await stored(page, 'drehung')).toBe('30');
    await expect(page.locator('output[for="cam-yaw"]')).toHaveText('30°');
    expect(await pixels(page, PREVIEW)).not.toBe(before);
    await tilt.fill('70');
    expect(await stored(page, 'neigung')).toBe('70');
    await expect(page.locator('output[for="cam-tilt"]')).toHaveText('70°');

    await reloadGame(page);
    await expect(yaw).toHaveValue('30');
    await expect(tilt).toHaveValue('70');
    await expect(page.locator('output[for="cam-yaw"]')).toHaveText('30°');

    await page.getByRole('button', { name: 'Zurücksetzen' }).click();
    await expect(yaw).toHaveValue('20');
    await expect(tilt).toHaveValue('50');
    await expect(page.locator('output[for="cam-yaw"]')).toHaveText('20°');
    await expect(page.locator('output[for="cam-tilt"]')).toHaveText('50°');
    expect(await stored(page, 'drehung')).toBe('20');
    expect(await stored(page, 'neigung')).toBe('50');
    expect(await pixels(page, PREVIEW)).toBe(before);
    expect(errors).toEqual([]);
  });

  test('ein Regler gibt nach der Änderung den Fokus ab (Pfeiltasten bleiben nicht hängen)', async ({ page }) => {
    await openGame(page, { hash: '#einstellungen' });
    const yaw = page.getByLabel('Drehung');
    await yaw.focus();
    await page.keyboard.press('ArrowRight');
    await expect(yaw).toHaveValue('21');
    await expect(yaw).not.toBeFocused();
    expect(await stored(page, 'drehung')).toBe('21');
  });

  test('die Handwahl gibt es nur mit Touch; „Linke Hand“ wird gemerkt', async ({ page }) => {
    await openGame(page, { hash: '#einstellungen' });
    const group = page.getByRole('group', { name: 'Knöpfe' });
    await expect(group).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Bedienung' })).toBeHidden();
    await page.evaluate(() => document.documentElement.classList.add('touch'));
    await expect(group).toBeVisible();
    const right = group.getByRole('button', { name: 'Rechte Hand' });
    const left = group.getByRole('button', { name: 'Linke Hand' });
    await expect(right).toHaveAttribute('aria-pressed', 'true');
    await left.click();
    await expect(left).toHaveAttribute('aria-pressed', 'true');
    await expect(right).toHaveAttribute('aria-pressed', 'false');
    expect(await stored(page, 'hand')).toBe('"links"');
    await reloadGame(page);
    await page.evaluate(() => document.documentElement.classList.add('touch'));
    await expect(left).toHaveAttribute('aria-pressed', 'true');
  });

  test('der Abschnitt „Als App installieren“ steht im Browser da, wörtlich', async ({ page }) => {
    await openGame(page, { hash: '#einstellungen' });
    await expect(page.getByRole('heading', { name: 'Als App installieren' })).toBeVisible();
    await expect(page.getByText('läuft auch ohne Internet.')).toBeVisible();
    await expect(page.getByText('Entwurfs-Artefakt')).toHaveCount(0);
  });
});

test.describe('mit Touch', () => {
  test.use({ hasTouch: true });

  test('Antippen blendet die Handwahl ein, eine Pfeiltaste wieder aus', async ({ page }) => {
    await openGame(page, { hash: '#einstellungen' });
    await page.getByRole('heading', { level: 2, name: 'Einstellungen' }).tap();
    await expect(page.getByRole('group', { name: 'Knöpfe' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('group', { name: 'Knöpfe' })).toBeHidden();
  });
});

test.describe('Bildschirme per Hash', () => {
  test('#level-3 wird zu #level, der Titel folgt dem Bildschirm', async ({ page }) => {
    await openGame(page, { hash: '#level-3' });
    await expect(page).toHaveURL(/\/#level$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Level wählen' })).toBeVisible();
    await expect(page).toHaveTitle('Level wählen · Kistenschieber');
    await expect(screen(page, 'start')).toBeHidden();
  });

  test('Unbekanntes zeigt den Start und verschwindet aus der Adresse', async ({ page }) => {
    await openGame(page, { hash: '#quatsch' });
    await expect(page).toHaveURL('http://localhost:4321/');
    await expect(screen(page, 'start')).toBeVisible();
    await expect(page).toHaveTitle('Kistenschieber');
  });

  test('Wechsel per Link: Titel, Bildschirm und Anfang der Seite', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await openGame(page, { hash: '#level' });
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await page.evaluate(() => (location.hash = '#einstellungen'));
    await expect(page).toHaveTitle('Einstellungen · Kistenschieber');
    await expect(screen(page, 'einstellungen')).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole('link', { name: 'Startbildschirm' }).click();
    await expect(page).toHaveTitle('Kistenschieber');
    await expect(screen(page, 'start')).toBeVisible();
    await expect(screen(page, 'einstellungen')).toBeHidden();
    await page.goBack();
    await expect(page).toHaveTitle('Einstellungen · Kistenschieber');
  });

  test('nach einem Wechsel liegt der Fokus auf der Überschrift des neuen Bildschirms', async ({ page }) => {
    await openGame(page);
    await screen(page, 'start').getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Einstellungen' })).toBeFocused();
    await page.getByRole('link', { name: 'Startbildschirm' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeFocused();
    await screen(page, 'start').getByRole('link', { name: 'Level wählen' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Level wählen' })).toBeFocused();
    await page.locator('#lektion-1').click();
    await expect(page.locator('#spiel canvas')).toBeFocused();
    await page.evaluate(() => (location.hash = '#level'));
    await page.locator('#lektion-3').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Diese Lektion ist noch zu' })).toBeFocused();
  });

  test('bevor das Skript läuft: nur der Bildschirm aus dem Hash, nie Start und Liste zusammen', async ({ page }) => {
    // Ohne das Skript bleibt die Seite im Zustand vor `ready` stehen
    await page.route('**/*.js', (r) => r.abort());
    await gotoGame(page);
    await expect(screen(page, 'start')).toBeVisible();
    await expect(screen(page, 'level')).toBeHidden();
    await gotoGame(page, '#level');
    await expect(screen(page, 'level')).toBeVisible();
    await expect(screen(page, 'start')).toBeHidden();
    await gotoGame(page, '#lektion-4');
    await expect(screen(page, 'level')).toBeVisible();
    await expect(screen(page, 'start')).toBeHidden();
    await gotoGame(page, '#einstellungen');
    await expect(screen(page, 'start')).toBeHidden();
    await expect(screen(page, 'level')).toBeHidden();
    await expect(game(page)).not.toHaveClass(/\bready\b/);
  });
});

test.describe('Levelwahl', () => {
  const card = (page: Page, n: number) => page.locator(`#lektion-${n}`);
  const badge = (page: Page, n: number) => card(page, n).locator('.badge');
  /** Zeichen hinter dem Titel (✓ geschafft, ↷ übersprungen), als CSS-Inhalt */
  const mark = (page: Page, n: number) =>
    card(page, n)
      .locator('strong')
      .evaluate((el) => getComputedStyle(el, '::after').content.replace(/^"|"$/g, '').trim());
  const opacity = (page: Page, n: number) => card(page, n).evaluate((el) => Number(getComputedStyle(el).opacity));

  test('leer: nur Lektion 1 frei, 2 bis 15 „Noch zu“ und ausgegraut; Vorschauen gezeichnet', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { hash: '#level' });
    await expect(page.getByText('Die Lektionen werden der Reihe nach frei;')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Einführung 15 Lektionen' })).toBeVisible();
    await expect(card(page, 1)).not.toHaveClass(/\blocked\b/);
    await expect(badge(page, 1)).toBeHidden();
    expect(await opacity(page, 1)).toBe(1);
    for (let n = 2; n <= 15; n++) {
      await expect(card(page, n)).toHaveClass(/\blocked\b/);
      await expect(badge(page, n)).toHaveText('Noch zu');
      expect(await opacity(page, n)).toBeLessThan(1);
    }
    for (const n of [1, 8, 15]) {
      await expect(page.getByRole('img', { name: `Vorschau von Lektion ${n}`, exact: true })).toBeVisible();
      expect(await drawn(page, `#lektion-${n} canvas`)).toBe(true);
    }
    await expect(card(page, 2)).toContainText('1 Kiste, kürzester Weg 6 Züge');
    expect(errors).toEqual([]);
  });

  test('✓ mit Bestwert, ↷ übersprungen, mit Lösung gesehen; jeweils die nächste frei', async ({ page }) => {
    await openGame(page, {
      hash: '#level',
      store: { 'best.e1': { moves: 11, pushes: 4 }, 'skip.e2': true, 'shown.e3': true },
    });
    await expect(card(page, 1)).toHaveClass(/\bdone\b/);
    expect(await mark(page, 1)).toBe('✓');
    await expect(badge(page, 1)).toHaveText('Geschafft, Bestwert 11 Züge');
    await expect(card(page, 2)).toHaveClass(/\bskipped\b/);
    expect(await mark(page, 2)).toBe('↷');
    await expect(badge(page, 2)).toHaveText('Übersprungen, später nachholen');
    await expect(card(page, 3)).toHaveClass(/\bshown\b/);
    await expect(badge(page, 3)).toHaveText('Mit Lösung gesehen');
    await expect(card(page, 4)).not.toHaveClass(/\blocked\b/);
    await expect(badge(page, 4)).toBeHidden();
    await expect(card(page, 5)).toHaveClass(/\blocked\b/);
  });

  test('nur Lektion 1 geschafft: Karte 2 frei und als einzige golden „dran“', async ({ page }) => {
    await openGame(page, { hash: '#level', store: { 'best.e1': { moves: 9, pushes: 4 } } });
    await expect(card(page, 2)).not.toHaveClass(/\blocked\b/);
    await expect(badge(page, 2)).toBeHidden();
    await expect(card(page, 2)).toHaveClass(/\bcur\b/);
    await expect(page.locator('#level .card.cur')).toHaveCount(1);
    const frame = await card(page, 2).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(frame).toContain('rgb(240, 165, 49)');
  });

  test('alle erledigt: Pille „abgeschlossen“', async ({ page }) => {
    const store: Record<string, unknown> = {};
    for (let n = 1; n <= 15; n++) store[`skip.e${n}`] = true;
    await openGame(page, { hash: '#level', store });
    await expect(page.locator('[data-ks="intro-pill"]')).toHaveText('abgeschlossen');
    await expect(page.locator('[data-ks="intro-pill"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#level .card.locked')).toHaveCount(0);
  });

  test('Ausblick: genau Kapitel 1 und 2, kein Link auf ein Level', async ({ page }) => {
    await openGame(page, { hash: '#level' });
    await expect(page.getByRole('heading', { level: 3, name: 'Level kommen bald' })).toBeVisible();
    const chapters = page.locator('#level .chapters li');
    await expect(chapters).toHaveText([
      'Kapitel 1: Am Kai Level 1 bis 12, 2 bis 3 Kisten',
      'Kapitel 2: Im Speicher Level 13 bis 24, 3 bis 4 Kisten',
    ]);
    await expect(page.locator('#level .chapters a')).toHaveCount(0);
    await expect(page.locator('a[href^="#level-"]')).toHaveCount(0);
    await expect(page.getByText('Zollhof')).toHaveCount(0);
  });

  test('gesperrte #lektion-5: Hinweis mit „Zu Lektion 1“, nach Lektion 1 „Zu Lektion 2“', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { hash: '#lektion-5' });
    const locked = screen(page, 'gesperrt');
    await expect(locked).toBeVisible();
    await expect(screen(page, 'level')).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'Diese Lektion ist noch zu' })).toBeVisible();
    await expect(locked.locator('#locked-which')).toHaveText('Lektion 5: An der Wand entlang noch zu');
    await expect(locked.locator('#locked-title')).toHaveAccessibleDescription('Lektion 5: An der Wand entlang noch zu');
    await expect(
      locked.getByText('Schaff zuerst Lektion 1: Erster Schubs oder überspring es; dann geht es weiter.'),
    ).toBeVisible();
    await expect(locked.getByRole('link', { name: 'Zu Lektion 1' })).toHaveAttribute('href', '#lektion-1');
    await expect(locked.getByRole('link', { name: 'Level wählen' })).toHaveAttribute('href', '#level');
    await expect(locked.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute('href', '#einstellungen');
    await expect(locked.getByText('Alles wird der Reihe nach frei.')).toBeVisible();
    await expect(page).toHaveTitle('Lektion 5 · Kistenschieber');

    await page.evaluate(() => localStorage.setItem('kistenschieber.best.e1', '{"moves":9,"pushes":4}'));
    await page.evaluate(() => (location.hash = '#lektion-6'));
    await expect(locked.getByText('Schaff zuerst Lektion 2: Um die Ecke')).toBeVisible();
    await expect(locked.locator('#locked-which')).toContainText('Lektion 6:');
    await expect(locked.getByRole('link', { name: 'Zu Lektion 2' })).toHaveAttribute('href', '#lektion-2');
    await locked.getByRole('link', { name: 'Zu Lektion 2' }).click();
    await expect(screen(page, 'gesperrt')).toBeHidden();
    await expect(
      screen(page, 'spiel').getByRole('heading', { level: 2, name: 'Lektion 2: Um die Ecke' }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Karten heben sich beim Überfahren, nicht bei reduzierter Bewegung', async ({ page }) => {
    await openGame(page, { hash: '#level' });
    await card(page, 1).hover();
    const lifted = () => card(page, 1).evaluate((el) => getComputedStyle(el).transform);
    expect(await lifted()).toBe('matrix(1, 0, 0, 1, 0, -3)');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await lifted()).toBe('none');
  });
});

test.describe('ohne JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('Titel, die 15 Lektionen mit Idee und ein Hinweis; kein Spielbild, keine Einstellungen', async ({ page }) => {
    await gotoGame(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
    for (const l of LESSONS) {
      await expect(page.locator(`#${l.id}`)).toContainText(`${l.n}. ${l.title}`);
      await expect(page.locator(`#${l.id}`)).toContainText(l.idea);
      await expect(page.locator(`#${l.id}`)).toBeVisible();
    }
    // Die Textsuche von Playwright übergeht <noscript>, daher über den Selektor
    const note = page.locator('#start noscript p');
    await expect(note).toBeVisible();
    await expect(note).toContainText('Zum Spielen braucht Kistenschieber JavaScript.');
    await expect(page.locator('canvas:visible')).toHaveCount(0);
    await expect(page.locator('.badge:visible')).toHaveCount(0);
    await expect(screen(page, 'gesperrt')).toBeHidden();
    await expect(page.locator('#level .chapters li')).toHaveCount(2);
    await expect(screen(page, 'einstellungen')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Einstellungen' })).toBeHidden();
  });
});

test('Spielseite ist nicht im Suchindex und meldet keinen Service Worker an', async ({ page }) => {
  await openGame(page);
  await page.waitForLoadState('load');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBe(0);
});

for (const width of [320, 390, 1280])
  for (const hash of ['', '#level', '#einstellungen', '#lektion-5'])
    test(`${hash || 'Start'} bei ${width} px ohne seitliches Scrollen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openGame(page, { hash });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

test('Unbekannte Adresse zeigt die 404-Seite mit dem Weg zurück', async ({ page }) => {
  const res = await page.goto('/gibt-es-nicht/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: /404/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zurück zum Kistenschieber?' })).toHaveAttribute('href', '/');
  const footer = page.locator('footer.site-footer');
  await expect(footer.getByRole('link', { name: 'Impressum und Kontakt' })).toHaveAttribute(
    'href',
    'https://larmic.de/impressum/',
  );
  await expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', `${HOME}datenschutz/`);
});

test.describe('ruhende Seiten', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  for (const scheme of ['light', 'dark'] as const)
    test(`Barrierefrei: 404 (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/gibt-es-nicht/');
      expect(await violations(page)).toEqual([]);
    });
});
