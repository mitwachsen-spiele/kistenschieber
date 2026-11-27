// Gemeinsame Helfer der Browser-Tests: Spiel öffnen und neu laden, bis es steht (`settled`), Speicher vorbelegen,
// Fehler der Seite sammeln, Barrierefreiheit prüfen, Test-Uhr (Bilder auf Zuruf). Nie auf Uhrzeit oder eine Zahl von
// Bildern warten, sondern auf einen Zustand: In der Pipeline dauert alles ein Vielfaches.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * So lange darf das Spiel zum Stehen brauchen: Laden und erstes Bild, in der Pipeline und in `gates:ci` (CI=1) auf
 * wenigen Kernen und parallel zu einem zweiten Test. Nativ reichen 10 s
 */
const SETTLE_MS = process.env.CI ? 30_000 : 10_000;
/** Ein Bild der Test-Uhr */
export const FRAME_MS = 50;
/** Präfix im localStorage (src/scripts/games/ks-save.ts) */
const PREFIX = 'kistenschieber.';

/** Sammelt Fehler der Seite; am Ende des Tests muss die Liste leer sein */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Verstöße gegen WCAG 2.2 A/AA laut axe-core: je Verstoß Regel, Wirkung und betroffene Elemente */
export async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return result.violations.map(
    (v) => `${v.impact}: ${v.id} – ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}

/** Das Spiel als Element */
export const game = (page: Page) => page.locator('ks-kistenschieber');

/** Warten, bis das Spiel steht (`settled`): Stand geladen, Bildschirm gezeigt, erstes Bild gezeichnet */
export const settled = (page: Page) => expect(game(page)).toHaveClass(/\bsettled\b/, { timeout: SETTLE_MS });

/**
 * Die Spielseite aufrufen, ohne zu warten, mit Hash (etwa '#einstellungen'). Nur für Tests, die das Laden selbst prüfen
 * (ohne JavaScript); sonst `openGame`
 */
export const gotoGame = (page: Page, hash = '') => page.goto(`/${hash}`);

/**
 * Test-Uhr der Seite, vor ihrem ersten Skript: `performance.now()` steht, bis `render` sie vorstellt; mit `__KS_TEST`
 * zeichnet das Spiel sofort statt im nächsten Bild (ks-kistenschieber.ts)
 */
function installClock() {
  const clock = { ms: 0 };
  const t0 = performance.now();
  (window as unknown as { __KS_TEST: typeof clock }).__KS_TEST = clock;
  performance.now = () => t0 + clock.ms;
}

/**
 * Speicher vorbelegen (Schlüssel ohne Präfix, Werte als JSON), einmal je Tab: Neu laden behält, was die Seite seitdem
 * selbst geschrieben hat
 */
export async function seed(page: Page, values: Record<string, unknown>) {
  await page.addInitScript(
    ([prefix, v]) => {
      if (sessionStorage.getItem('ks-seeded')) return;
      sessionStorage.setItem('ks-seeded', '1');
      for (const [k, x] of Object.entries(v)) localStorage.setItem(prefix + k, JSON.stringify(x));
    },
    [PREFIX, values] as const,
  );
}

/** Spiel öffnen (mit Hash, Speicher vorbelegt, Test-Uhr), bis es steht */
export async function openGame(
  page: Page,
  { hash = '', store = {}, clock = true }: { hash?: string; store?: Record<string, unknown>; clock?: boolean } = {},
) {
  if (Object.keys(store).length) await seed(page, store);
  if (clock) await page.addInitScript(installClock);
  await gotoGame(page, hash);
  await settled(page);
  return game(page);
}

/** Seite neu laden und warten, bis das Spiel wieder steht */
export async function reloadGame(page: Page) {
  await page.reload();
  await settled(page);
}

/** Test-Uhr: `n` Bilder, je `ms` später */
export const render = (page: Page, n = 1, ms = FRAME_MS) =>
  game(page).evaluate(
    (node, [count, gap]) => {
      const el = node as unknown as { frame(): void };
      const clock = (window as unknown as { __KS_TEST: { ms: number } }).__KS_TEST;
      for (let i = 0; i < count; i++) {
        clock.ms += gap;
        el.frame();
      }
    },
    [n, ms] as const,
  );

/** Ein Wert aus dem Speicher des Spiels (Schlüssel ohne Präfix), roh wie gespeichert */
export const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), PREFIX + key);

/** Bildinhalt einer Canvas (zum Vergleich vor und nach einer Änderung) */
export const pixels = (page: Page, selector: string) =>
  page.locator(selector).evaluate((cv) => (cv as HTMLCanvasElement).toDataURL());

/** Ist die Mitte der Canvas bemalt (deckend)? */
export const drawn = (page: Page, selector: string) =>
  page.locator(selector).evaluate((node) => {
    const cv = node as HTMLCanvasElement;
    const px = cv.getContext('2d')?.getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
    return cv.width > 0 && cv.height > 0 && (px?.[3] ?? 0) > 0;
  });
