// Die Spielseite ohne Spielfeld (das prüft e2e/game.spec.ts): Startbildschirm, Einstellungen, Bildschirme per Hash und ohne JavaScript, dazu die
// 404-Seite. Ohne Fehler in der Konsole, ohne seitliches Scrollen, nicht im Suchindex.
import { expect, test, type Page } from '@playwright/test';
import { LESSONS } from '../src/data/games/lessons';
import { drawn, game, gotoGame, openGame, pixels, reloadGame, stored, violations, watchErrors } from './helpers';

const HOME = 'https://www.mitwachsen-spiele.de/';
const START = '#start canvas';
const PREVIEW = '#einstellungen canvas';

const screen = (page: Page, id: string) => page.locator(`ks-kistenschieber > section#${id}`);
/** Teile des Startbildschirms: die spielbare Einführung und die Level, die erst kommen */
const intro = (page: Page) => page.locator('#start .part.now');
const soon = (page: Page) => page.locator('#start .part.soon');

test.describe('Startbildschirm', () => {
  test('zeigt Titel, Knöpfe und die gezeichnete erste Lektion, ohne Fehler', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Kistenschieber' })).toBeVisible();
    const start = screen(page, 'start');
    await expect(intro(page).getByText('0 von 15 Lektionen geschafft')).toBeVisible();
    await expect(intro(page).getByRole('link', { name: 'Spielen', exact: true })).toHaveAttribute('href', '#lektion-1');
    await expect(start.getByRole('link', { name: 'Lektion wählen' })).toHaveAttribute('href', '#level');
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
    await expect(intro(page).getByText('1 von 15 Lektionen geschafft')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Lektion 2: Um die Ecke als Bild' })).toBeVisible();
    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page.getByRole('link', { name: 'Zurück zum Spiel' })).toHaveAttribute('href', '#lektion-2');
  });

  test('„Spielen“, solange nichts angefangen ist, auch mit einer gesperrten letzten Lektion', async ({ page }) => {
    await openGame(page, { store: { last: 'e7' } });
    await expect(page.getByRole('link', { name: 'Spielen', exact: true })).toHaveAttribute('href', '#lektion-1');
  });

  test('zwei Teile: die Einführung spielbar mit dem goldenen Knopf, die Level „kommen bald“ ohne Link und ohne Gold', async ({
    page,
  }) => {
    await openGame(page);
    const start = screen(page, 'start');
    await expect(start.getByRole('heading', { level: 2, name: 'Einführung jetzt spielbar' })).toBeVisible();
    await expect(intro(page).getByText('Lernen in 15 Lektionen')).toBeVisible();
    await expect(intro(page).locator('.btn.primary')).toHaveText('Spielen');
    await expect(start.locator('.btn.primary')).toHaveCount(1);
    await expect(start.getByRole('heading', { level: 2, name: 'Level kommen bald' })).toBeVisible();
    await expect(soon(page).getByText('Noch nicht spielbar.')).toBeVisible();
    await expect(soon(page).getByText('Kapitel 1: Am Kai und Kapitel 2: Im Speicher, Level 1 bis 24')).toBeVisible();
    // Nur Ankündigung: nichts zum Anklicken, kein Zeiger, kein Gold, nicht im Tab-Weg
    await expect(soon(page).locator('a, button, [tabindex]')).toHaveCount(0);
    const look = await soon(page).evaluate((el) => {
      const cs = getComputedStyle(el);
      return { cursor: cs.cursor, bg: cs.backgroundColor, outline: cs.outlineStyle };
    });
    expect(look).toEqual({ cursor: 'auto', bg: 'rgb(226, 213, 186)', outline: 'dashed' });
    await expect(intro(page)).not.toHaveClass(/\bdone\b/);
  });

  test('alles übersprungen ist nicht geschafft: kein Haken, der Knopf führt zum Nachholen', async ({ page }) => {
    const store: Record<string, unknown> = { last: 'e15' };
    for (let n = 1; n <= 15; n++) store[`skip.e${n}`] = true;
    await openGame(page, { store });
    await expect(intro(page).locator('[data-ks="intro-state"]')).toHaveText('jetzt spielbar');
    await expect(intro(page).getByText('0 von 15 Lektionen geschafft, 15 übersprungen')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Weiterspielen: Lektion 1' })).toHaveAttribute('href', '#lektion-1');
  });

  test('eine übersprungen, der Rest gelöst: der Knopf führt zur übersprungenen statt zur gelösten letzten', async ({
    page,
  }) => {
    const store: Record<string, unknown> = { last: 'e15', 'skip.e7': true };
    for (let n = 1; n <= 15; n++) if (n !== 7) store[`best.e${n}`] = { moves: 9, pushes: 4 };
    await openGame(page, { store });
    await expect(intro(page)).not.toHaveClass(/\bdone\b/);
    await expect(intro(page).getByText('14 von 15 Lektionen geschafft, 1 übersprungen')).toBeVisible();
    await expect(intro(page).getByRole('link', { name: 'Weiterspielen: Lektion 7' })).toHaveAttribute(
      'href',
      '#lektion-7',
    );
  });

  test('geschafft und beim Wiederholen: „Weiterspielen: Lektion N“ mit Haken', async ({ page }) => {
    const store: Record<string, unknown> = { last: 'e6' };
    for (let n = 1; n <= 15; n++) store[`best.e${n}`] = { moves: 9, pushes: 4 };
    await openGame(page, { store });
    await expect(intro(page).locator('[data-ks="intro-state"]')).toHaveText('✓ geschafft');
    await expect(intro(page).getByRole('link', { name: 'Weiterspielen: Lektion 6' })).toHaveAttribute(
      'href',
      '#lektion-6',
    );
  });

  test('die Pillen sehen verschieden aus: „jetzt spielbar“ hell mit dunklem Rand, „kommen bald“ gedämpft', async ({
    page,
  }) => {
    await openGame(page);
    const look = (sel: string) =>
      page.locator(sel).evaluate((el) => {
        const cs = getComputedStyle(el);
        return `${cs.backgroundColor} ${cs.color}`;
      });
    expect(await look('#start .part.now .pill')).not.toBe(await look('#start .part.soon .pill'));
  });

  test('Einführung geschafft (selbst gelöst oder mit Lösung gesehen): „✓ geschafft“, „Einführung wiederholen“', async ({
    page,
  }) => {
    const store: Record<string, unknown> = { last: 'e15' };
    for (let n = 1; n <= 14; n++) store[`best.e${n}`] = { moves: 9, pushes: 4 };
    store['shown.e15'] = true;
    await openGame(page, { store });
    const start = screen(page, 'start');
    await expect(start.getByRole('heading', { level: 2, name: 'Einführung ✓ geschafft' })).toBeVisible();
    await expect(intro(page)).toHaveClass(/\bdone\b/);
    await expect(intro(page).locator('[data-ks="intro-state"]')).toHaveClass(/\bon\b/);
    await expect(intro(page).getByText('Alle 15 Lektionen erledigt.')).toBeVisible();
    const again = intro(page).getByRole('link', { name: 'Einführung wiederholen' });
    await expect(again).toHaveAttribute('href', '#lektion-1');
    await expect(page.getByRole('img', { name: 'Lektion 1: Erster Schubs als Bild' })).toBeVisible();
    await expect(start.getByRole('heading', { level: 2, name: 'Level kommen bald' })).toBeVisible();
    await start.getByRole('link', { name: 'Lektion wählen' }).click();
    await expect(page.locator('[data-ks="intro-pill"]')).toHaveText('✓ geschafft');
  });

  // Handy hoch und quer passt der ganze Start ohne Scrollen; kleinere Handys mindestens der große Knopf
  for (const [width, height, whole] of [
    [390, 844, true],
    [844, 390, true],
    [667, 375, true],
    [375, 667, false],
  ] as const)
    test(`${width}×${height}: der große Knopf der Einführung ohne Scrollen${whole ? ', auch Level und Nebenknöpfe' : ''}, die Level getrennt`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openGame(page);
      const go = await intro(page).locator('[data-ks="continue"]').boundingBox();
      const a = await intro(page).boundingBox();
      const b = await soon(page).boundingBox();
      expect(go && go.y + go.height).toBeLessThanOrEqual(height);
      // Die beiden Teile überlappen nicht
      expect(a && b && (a.y + a.height <= b.y || a.x + a.width <= b.x)).toBe(true);
      if (whole) {
        const btns = await screen(page, 'start').locator('.startbtns').boundingBox();
        expect(b && b.y + b.height).toBeLessThanOrEqual(height);
        expect(btns && btns.y + btns.height).toBeLessThanOrEqual(height);
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height);
      }
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
    await expect(page.getByRole('heading', { level: 2, name: 'Lektion wählen' })).toBeVisible();
    await expect(page).toHaveTitle('Lektion wählen · Kistenschieber');
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
    await screen(page, 'start').getByRole('link', { name: 'Lektion wählen' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Lektion wählen' })).toBeFocused();
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

  test('nur übersprungen: Pille bleibt „15 Lektionen“, alle Karten frei', async ({ page }) => {
    const store: Record<string, unknown> = {};
    for (let n = 1; n <= 15; n++) store[`skip.e${n}`] = true;
    await openGame(page, { hash: '#level', store });
    await expect(page.locator('[data-ks="intro-pill"]')).toHaveText('15 Lektionen');
    await expect(page.locator('[data-ks="intro-pill"]')).not.toHaveClass(/\bon\b/);
    await expect(page.locator('#level .card.locked')).toHaveCount(0);
  });

  test('alle geschafft oder mit Lösung gesehen: Pille „✓ geschafft“', async ({ page }) => {
    const store: Record<string, unknown> = {};
    for (let n = 1; n <= 15; n++) store[n % 2 ? `best.e${n}` : `shown.e${n}`] = n % 2 ? { moves: 9, pushes: 4 } : true;
    await openGame(page, { hash: '#level', store });
    await expect(page.locator('[data-ks="intro-pill"]')).toHaveText('✓ geschafft');
    await expect(page.locator('[data-ks="intro-pill"]')).toHaveClass(/\bon\b/);
  });
  test('Ausblick: genau Kapitel 1 und 2, kein Link auf ein Level', async ({ page }) => {
    await openGame(page, { hash: '#level' });
    await expect(page.getByRole('heading', { level: 3, name: 'Level kommen bald' })).toBeVisible();
    await expect(screen(page, 'level').getByText('Noch nicht spielbar.')).toBeVisible();
    await expect(page.getByText('Spielbar ist bisher nur die Einführung, die Level kommen bald.')).toBeVisible();
    // Dieselbe gestrichelte Karte wie auf dem Startbildschirm, ohne Link
    const card = screen(page, 'level').locator('.part.soon');
    await expect(card).toContainText('Noch nicht spielbar.');
    expect(await card.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('dashed');
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
    await expect(locked.getByRole('link', { name: 'Lektion wählen' })).toHaveAttribute('href', '#level');
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
    // Beide Teile des Starts stehen auch ohne JavaScript als Text da
    await expect(page.getByRole('heading', { level: 2, name: 'Einführung jetzt spielbar' })).toBeVisible();
    await expect(page.getByText('0 von 15 Lektionen geschafft')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Level kommen bald' })).toBeVisible();
    await expect(screen(page, 'einstellungen')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Einstellungen' })).toBeHidden();
  });
});

test('Spielseite ist nicht im Suchindex, hat zwei Farben für die Browserleiste und verweist aufs Manifest', async ({
  page,
}) => {
  await openGame(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Kisten');
});

test('Manifest: installierbar als „Kistenschieber“, startet im Spiel, Icons mit der Kiste in den richtigen Größen', async ({
  page,
}) => {
  const res = await page.request.get('/manifest.webmanifest');
  expect(res.headers()['content-type']).toBe('application/manifest+json');
  const m = (await res.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    theme_color: string;
    orientation?: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };
  expect(m).toMatchObject({ name: 'Kistenschieber', short_name: 'Kisten', start_url: '/', scope: '/' });
  expect(m.display).toBe('standalone');
  expect(m.theme_color).toBe('#8dd0ee');
  expect(m.orientation).toBeUndefined();
  expect(m.icons.map((i) => `${i.src} ${i.sizes} ${i.purpose}`)).toEqual([
    '/icon-192.png 192x192 any',
    '/icon-512.png 512x512 any',
    '/icon-maskable-512.png 512x512 maskable',
  ]);
  for (const icon of m.icons) {
    const png = await page.request.get(icon.src);
    expect(png.headers()['content-type']).toBe('image/png');
    const body = await png.body();
    expect(`${body.readUInt32BE(16)}x${body.readUInt32BE(20)}`).toBe(icon.sizes);
  }
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
