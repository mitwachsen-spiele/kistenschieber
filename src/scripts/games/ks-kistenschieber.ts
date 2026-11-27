// <ks-kistenschieber>: das Spiel. Alle Bildschirme stehen als statisches HTML in der Komponente
// (KistenschieberGame.astro); sie zeigt je Hash einen davon (ks-router.ts) und füllt ihn mit dem Stand des Geräts.
// Listener auf document/window hängen an einem AbortController und verschwinden mit der Komponente.
// Klassen für die Browser-Tests: `ready` (Stand geladen, Bildschirme verdrahtet), `settled` (das erste Bild des gerade
// gezeigten Bildschirms ist gezeichnet; jeder Bildschirmwechsel nimmt die Klasse weg, bis sein Bild steht).
// Test-Uhr: Mit `window.__KS_TEST` zeichnet die Komponente sofort statt im nächsten Bild; Tests rufen `frame` selbst.
import { type Camera, clampCamera, makeCamera } from '../../lib/games/oblique/camera';
import { browserStore } from './browser-store';
import { loadSettings, progressKV, saveSetting, type Settings, type Store } from './ks-save';
import { unlocked } from '../../lib/games/sokoban/progress';
import { route, type Route } from './ks-router';
import { COUNT, type Host, LevelScreen, LockedScreen, SettingsScreen, StartScreen } from './ks-screens';
import { watchTouch } from './ks-touch';

/**
 * Welcher Abschnitt zeigt den Bildschirm: Eine gesperrte Lektion zeigt, warum sie zu ist; eine freie bis zum Spielfeld
 * die Levelwahl mit ihrer Karte
 */
type Section = 'start' | 'level' | 'einstellungen' | 'gesperrt';

class KsKistenschieber extends HTMLElement {
  private globals: AbortController | null = null;
  private observer: ResizeObserver | null = null;
  private readonly manual = '__KS_TEST' in window;
  private store!: Store;
  private settings!: Settings;
  private cam!: Camera;
  private start!: StartScreen;
  private prefs!: SettingsScreen;
  private levels!: LevelScreen;
  private locked!: LockedScreen;
  private kv!: Host['kv'];
  private shown: Section = 'start';
  private queued = false;
  private readonly widths = new WeakMap<Element, number>();

  connectedCallback() {
    if (this.globals) return;
    this.globals = new AbortController();
    const { signal } = this.globals;
    this.store = browserStore().store;
    this.settings = loadSettings(this.store);
    this.cam = this.makeCam();
    watchTouch(signal);
    this.kv = progressKV(this.store);
    const host: Host = {
      kv: this.kv,
      settings: () => this.settings,
      set: (key, value) => {
        this.settings = { ...this.settings, [key]: value };
        saveSetting(this.store, key, value);
        this.cam = this.makeCam();
      },
      camera: () => this.cam,
    };
    this.start = new StartScreen(this.section('start'), host);
    this.prefs = new SettingsScreen(this.section('einstellungen'), host, signal);
    this.levels = new LevelScreen(this.section('level'), host);
    this.locked = new LockedScreen(this.section('gesperrt'), host);
    addEventListener('hashchange', () => this.show(true), { signal });
    // Neu zeichnen, wenn sich die Breite einer Szene ändert (Drehen des Geräts, Fenster)
    this.observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        if (w !== this.widths.get(e.target)) {
          this.widths.set(e.target, w);
          this.request();
        }
      }
    });
    for (const s of this.querySelectorAll('.scene, .thumb')) this.observer.observe(s);
    this.show();
    this.classList.add('ready');
  }

  disconnectedCallback() {
    this.globals?.abort();
    this.globals = null;
    this.observer?.disconnect();
    this.observer = null;
  }

  private makeCam(): Camera {
    const { yaw, tilt } = clampCamera(this.settings.drehung, this.settings.neigung);
    return makeCamera(yaw, tilt);
  }

  private sectionFor(r: Route): Section {
    if (r.screen !== 'lektion') return r.screen;
    return r.n !== null && unlocked(this.kv, r.n) ? 'level' : 'gesperrt';
  }

  private section(id: string): HTMLElement {
    const s = this.querySelector<HTMLElement>(`:scope > section#${id}`);
    if (!s) throw new Error(`Kistenschieber: Bildschirm ${id} fehlt`);
    return s;
  }

  /**
   * Bildschirm zum Hash zeigen; Umleitungen ersetzen den Eintrag im Verlauf. Nach einem Wechsel (nicht beim Laden) geht
   * der Fokus auf die Überschrift des neuen Bildschirms (bei einer Lektion auf ihre Karte), damit er nicht auf einem
   * verborgenen Link liegen bleibt und Screenreader den Wechsel ansagen
   */
  private show(moved = false) {
    const r = route(location.hash, COUNT);
    if (r.replace !== null) history.replaceState(history.state, '', r.replace || location.pathname + location.search);
    this.classList.remove('settled');
    const id = this.sectionFor(r);
    this.shown = id;
    for (const s of this.querySelectorAll<HTMLElement>(':scope > section')) s.hidden = s.id !== id;
    document.title = r.title;
    if (id === 'start') this.start.enter();
    else if (id === 'einstellungen') this.prefs.enter();
    else if (id === 'level') this.levels.enter();
    else this.locked.enter(r.n);
    // Der Browser springt sonst zum Element mit der id aus dem Hash; eine freie Lektion zeigt vorerst ihre Karte
    const card = r.n === null || id !== 'level' ? null : document.getElementById(`lektion-${r.n}`);
    if (card) card.scrollIntoView({ block: 'center', behavior: 'instant' });
    else scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (moved) {
      const target = card ?? this.section(id).querySelector<HTMLElement>('h1, h2');
      target?.focus({ preventScroll: true });
    }
    this.request();
  }

  /** Neu zeichnen: im nächsten Bild, mit Test-Uhr sofort */
  private request() {
    if (this.manual) return this.frame();
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.frame();
    });
  }

  /** Ein Bild: die Szene des sichtbaren Bildschirms (auch von der Test-Uhr gerufen) */
  frame() {
    if (!this.globals) return;
    if (this.shown === 'start') this.start.draw();
    else if (this.shown === 'einstellungen') this.prefs.draw();
    else if (this.shown === 'level') this.levels.draw();
    if (this.classList.contains('settled')) return;
    if (this.manual) this.classList.add('settled');
    else requestAnimationFrame(() => this.classList.add('settled'));
  }
}

if (!customElements.get('ks-kistenschieber')) customElements.define('ks-kistenschieber', KsKistenschieber);
