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
 * Standard-Datum der Test-Uhr: vor dem Adventskalender, damit die Tests nicht vom Tag abhängen, an dem sie laufen. Tests
 * der Level stellen ihr Datum selbst (`openGame(page, { date })`)
 */
export const BEFORE_ADVENT = '2026-11-27T12:00:00+01:00';

/**
 * Test-Uhr der Seite, vor ihrem ersten Skript: `performance.now()` steht, bis `render` sie vorstellt; mit `__KS_TEST`
 * zeichnet das Spiel sofort statt im nächsten Bild (ks-kistenschieber.ts). `date` ist das Datum für den
 * Adventskalender (ms seit 1970)
 */
function installClock(date: number) {
  const clock = { ms: 0, date };
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

/**
 * Spiel öffnen (mit Hash, Speicher vorbelegt, Test-Uhr samt Datum, Standard `BEFORE_ADVENT`), bis es steht. Ohne
 * Test-Uhr gilt das echte Datum
 */
export async function openGame(
  page: Page,
  {
    hash = '',
    store = {},
    clock = true,
    date = BEFORE_ADVENT,
  }: { hash?: string; store?: Record<string, unknown>; clock?: boolean; date?: string } = {},
) {
  if (Object.keys(store).length) await seed(page, store);
  if (clock) await page.addInitScript(installClock, Date.parse(date));
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

/**
 * Fingerabdruck des Bildinhalts einer Canvas (SHA-256 der PNG-Daten), zum Vergleich vor und nach einer Änderung.
 * Nur der Hash, nie die Data-URL selbst: Playwright schreibt die Werte jedes `expect` in den Bericht, ganze Bilder
 * machten den Blob-Bericht mehrere MB groß (der Job e2e-merge konnte ihn dann nicht mehr laden).
 */
export const pixels = (page: Page, selector: string) =>
  page.locator(selector).evaluate(async (cv) => {
    const data = new TextEncoder().encode((cv as HTMLCanvasElement).toDataURL());
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  });

/** Ist die Mitte der Canvas bemalt (deckend)? */
export const drawn = (page: Page, selector: string) =>
  page.locator(selector).evaluate((node) => {
    const cv = node as HTMLCanvasElement;
    const px = cv.getContext('2d')?.getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
    return cv.width > 0 && cv.height > 0 && (px?.[3] ?? 0) > 0;
  });

/** Pfeiltaste je Buchstabe einer Lösung in LURD (Großbuchstabe = Schub, gedrückt wird dieselbe Taste) */
const LURD_KEY: Record<string, string> = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' };

/**
 * Züge in LURD spielen, in einem Rutsch: je Zug ein keydown am Element mit dem Fokus, dann so viele Bilder der
 * Test-Uhr, bis der Schritt fertig ist (der längste dauert 170 ms). Für lange Lösungen; einzelne Tasten im Test mit
 * `page.keyboard.press` und `render`
 */
export const playLurd = (page: Page, lurd: string) =>
  game(page).evaluate(
    (node, [moves, keys, gap]) => {
      const el = node as unknown as { frame(): void };
      const clock = (window as unknown as { __KS_TEST: { ms: number } }).__KS_TEST;
      for (const ch of moves) {
        const key = keys[ch.toLowerCase()];
        const target = document.activeElement ?? document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        for (let i = 0; i < 4; i++) {
          clock.ms += gap;
          el.frame();
        }
      }
    },
    [lurd, LURD_KEY, FRAME_MS] as const,
  );

/** Wie viele Pixel der Canvas fast genau diese Farbe haben (je Kanal ± 6) */
export const colourCount = (page: Page, selector: string, [r, g, b]: readonly [number, number, number]) =>
  page.locator(selector).evaluate(
    (node, [cr, cg, cb]) => {
      const cv = node as HTMLCanvasElement;
      const d = cv.getContext('2d')?.getImageData(0, 0, cv.width, cv.height).data ?? new Uint8ClampedArray();
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (Math.abs(d[i]! - cr) <= 6 && Math.abs(d[i + 1]! - cg) <= 6 && Math.abs(d[i + 2]! - cb) <= 6) n++;
      return n;
    },
    [r, g, b] as const,
  );

/**
 * Warten, bis der nachgeladene Teil (ks-menu: Konfetti) da ist. Das Spielfeld holt ihn beim
 * Öffnen einer Lektion; wer Konfetti sehen will, wartet vorher darauf
 */
export const extras = (page: Page) =>
  expect(page.locator('ks-kistenschieber > section#spiel')).toHaveClass(/\bextras\b/, { timeout: SETTLE_MS });

/** Ein Bodenfeld (r, c) oder eine Kiste (Nummer) des Spielfelds */
export type Spot = { r: number; c: number } | { crate: number };

/** Wohin tippen (Seitenkoordinaten), um genau dieses Feld oder diese Kiste zu treffen (ks-game.ts `spot`) */
export async function spot(page: Page, s: Spot) {
  const p = await game(page).evaluate(
    (node, target) => (node as unknown as { spot(t: unknown): { x: number; y: number } | null }).spot(target),
    s,
  );
  if (!p) throw new Error(`kein Punkt für ${JSON.stringify(s)}`);
  return p;
}

/**
 * Wischen mit einem Finger (Touch-Ereignisse über CDP, daraus macht Chromium Pointer-Events mit pointerType touch):
 * von (x, y) in Schritten um (dx, dy)
 */
export async function swipe(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 4; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 4, y: y + (dy * i) / 4 }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/**
 * Wake Lock vortäuschen, vor dem ersten Skript der Seite (Headless-Chromium lehnt die echte Sperre ab): Jede Anfrage und
 * jede Freigabe landet in `window.__wakeLog`
 */
export const fakeWakeLock = (page: Page) =>
  page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __wakeLog: string[] }).__wakeLog = log;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request(type: string) {
          log.push(`request ${type}`);
          return Promise.resolve({
            release() {
              log.push('release');
              return Promise.resolve();
            },
            addEventListener() {},
          });
        },
      },
    });
  });

/** Was die vorgetäuschte Wake-Lock-Sperre erlebt hat */
export const wakeLog = (page: Page) => page.evaluate(() => (window as unknown as { __wakeLog: string[] }).__wakeLog);

type Box = { x: number; y: number; width: number; height: number } | null;

/** Rahmen eines Elements auf der Seite (null, wenn es nicht angezeigt wird) */
export const box = (page: Page, selector: string): Promise<Box> => page.locator(selector).boundingBox();

/** Zwei Rahmen überschneiden sich nicht (ein fehlender oder leerer Rahmen überschneidet nichts) */
export const apart = (a: Box, b: Box) =>
  !a ||
  !b ||
  a.width * a.height === 0 ||
  b.width * b.height === 0 ||
  a.x + a.width <= b.x ||
  b.x + b.width <= a.x ||
  a.y + a.height <= b.y ||
  b.y + b.height <= a.y;

/** Was der vorgetäuschte AudioContext erlebt hat: angelegte Contexts, Zustand des letzten, gespielte Töne */
export interface AudioLog {
  contexts: number;
  state: string;
  /** je Ton die Frequenz (Rauschen: `noise`) */
  notes: (number | 'noise')[];
}

/**
 * AudioContext vortäuschen, vor dem ersten Skript der Seite (headless erklingt nichts, gezählt wird hier): Jeder
 * gestartete Ton landet in `window.__audio.notes`, mit seiner Frequenz
 */
export const fakeAudio = (page: Page) =>
  page.addInitScript(() => {
    const log = { contexts: 0, state: 'none', notes: [] as (number | 'noise')[] };
    (window as unknown as { __audio: typeof log }).__audio = log;
    const param = () => {
      const p = {
        value: 0,
        setValueAtTime(v: number) {
          p.value = v;
        },
        exponentialRampToValueAtTime() {},
        setTargetAtTime() {},
      };
      return p;
    };
    const node = () => ({ connect: (n: unknown) => n, disconnect() {} });
    // Ein Ton endet gleich nach dem Einplanen (onended), damit die Grenze der Stimmen (sfx.ts) nicht zuschlägt
    const source = (freq: () => number | 'noise') => {
      const src = {
        ...node(),
        onended: null as (() => void) | null,
        start() {
          log.notes.push(freq());
        },
        stop() {
          setTimeout(() => src.onended?.(), 0);
        },
      };
      return src;
    };
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      sampleRate = 8000;
      destination = node();
      constructor() {
        log.contexts++;
        log.state = this.state;
      }
      private set(s: string) {
        this.state = log.state = s;
        return Promise.resolve();
      }
      resume() {
        return this.set('running');
      }
      suspend() {
        return this.set('suspended');
      }
      close() {
        return this.set('closed');
      }
      createGain() {
        return { ...node(), gain: param() };
      }
      createDynamicsCompressor() {
        return node();
      }
      createBiquadFilter() {
        return { ...node(), type: '', frequency: param(), Q: param() };
      }
      createOscillator() {
        const frequency = param();
        return Object.assign(
          source(() => frequency.value),
          { type: '', frequency },
        );
      }
      createBufferSource() {
        return Object.assign(
          source(() => 'noise' as const),
          { buffer: null },
        );
      }
      createBuffer(_channels: number, length: number) {
        const data = new Float32Array(length);
        return { getChannelData: () => data };
      }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
  });

/** Was der vorgetäuschte AudioContext erlebt hat */
export const audioLog = (page: Page) => page.evaluate(() => (window as unknown as { __audio: AudioLog }).__audio);
