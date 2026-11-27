// <ks-kistenschieber>: das Spiel. Alle Bildschirme stehen als statisches HTML in der Komponente
// (KistenschieberGame.astro); sie zeigt je Hash einen davon (ks-router.ts) und füllt ihn mit dem Stand des Geräts.
// Listener auf document/window hängen an einem AbortController und verschwinden mit der Komponente.
// Klassen für die Browser-Tests: `ready` (Stand geladen, Bildschirme verdrahtet), `settled` (das erste Bild des gerade
// gezeigten Bildschirms ist gezeichnet; jeder Bildschirmwechsel nimmt die Klasse weg, bis sein Bild steht).
// Test-Uhr: Mit `window.__KS_TEST` zeichnet die Komponente sofort statt im nächsten Bild; Tests rufen `frame` selbst
// (auch für jeden Takt einer Animation: ohne Test-Uhr läuft der Takt per requestAnimationFrame, solange etwas läuft).
// Klasse `playing` (an der Komponente und an body) nur, solange eine freie Lektion gespielt wird: Spielfeld im ganzen
// Bildschirm, ohne Scrollen, Bildschirm bleibt an (Wake Lock). Ein Bildschirmwechsel schließt das Menü im Spiel.
import { type Camera, clampCamera, makeCamera } from '../../lib/games/oblique/camera';
import { browserStore } from './browser-store';
import { loadSettings, progressKV, saveSetting, type Settings, type Store } from './ks-save';
import { unlocked } from '../../lib/games/sokoban/progress';
import { route, type Route } from './ks-router';
import { COUNT, type Host, LevelScreen, LockedScreen, SettingsScreen, StartScreen } from './ks-screens';
import { GameScreen, type Spot } from './ks-game';
import { watchTouch } from './ks-touch';
import { type ScreenLock, watchWakeLock } from './wake-lock';
import { type GameMoment, type Screen as Section, SAFE_EVENT } from './pwa-moment';

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
  private play!: GameScreen;
  private wake!: ScreenLock;
  private kv!: Host['kv'];
  private shown: Section = 'start';
  private queued = false;
  private readonly sizes = new WeakMap<Element, string>();

  connectedCallback() {
    if (this.globals) return;
    this.globals = new AbortController();
    const { signal } = this.globals;
    this.store = browserStore().store;
    this.settings = loadSettings(this.store);
    this.cam = this.makeCam();
    watchTouch(signal);
    this.wake = watchWakeLock(signal);
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
    this.play = new GameScreen(this.section('spiel'), host, () => this.request(), signal);
    addEventListener('hashchange', () => this.show(true), { signal });
    addEventListener(
      'keydown',
      (e) => {
        // Rahmen ums Spielfeld nur, wenn es mit Tab angesteuert wurde: Pfeiltasten machen den Fokus im Browser
        // ebenfalls „sichtbar“, das Feld läge sonst beim Spielen ständig in einem goldenen Rahmen (game.css)
        this.classList.toggle('tabnav', e.key === 'Tab');
        if (this.shown === 'spiel') this.play.onKey(e);
      },
      { signal },
    );
    addEventListener('pointerdown', () => this.classList.remove('tabnav'), { signal, capture: true });
    // Neu zeichnen, wenn sich die Breite einer Szene ändert (Fenster) oder Breite oder Höhe des Spielfelds (Drehen)
    this.observer = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        const size = e.target.classList.contains('field') ? `${w}x${Math.round(e.contentRect.height)}` : `${w}`;
        if (size !== this.sizes.get(e.target)) {
          this.sizes.set(e.target, size);
          this.request();
        }
      }
    });
    for (const s of this.querySelectorAll('.scene, .thumb, .field')) this.observer.observe(s);
    this.show();
    this.classList.add('ready');
  }

  disconnectedCallback() {
    this.globals?.abort();
    document.body.classList.remove('playing');
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
    return r.n !== null && unlocked(this.kv, r.n) ? 'spiel' : 'gesperrt';
  }

  private section(id: string): HTMLElement {
    const s = this.querySelector<HTMLElement>(`:scope > section#${id}`);
    if (!s) throw new Error(`Kistenschieber: Bildschirm ${id} fehlt`);
    return s;
  }

  /**
   * Bildschirm zum Hash zeigen; Umleitungen ersetzen den Eintrag im Verlauf. Nach einem Wechsel (nicht beim Laden) geht
   * der Fokus auf die Überschrift des neuen Bildschirms (im Spiel auf das Feld), damit er nicht auf einem verborgenen
   * Link liegen bleibt und Screenreader den Wechsel ansagen
   */
  private show(moved = false) {
    const r = route(location.hash, COUNT);
    if (r.replace !== null) history.replaceState(history.state, '', r.replace || location.pathname + location.search);
    this.classList.remove('settled');
    const id = this.sectionFor(r);
    if (this.shown === 'spiel') this.play.leave();
    this.shown = id;
    this.wake.show(id);
    for (const s of this.querySelectorAll<HTMLElement>(':scope > section')) s.hidden = s.id !== id;
    const playing = id === 'spiel';
    this.classList.toggle('playing', playing);
    document.body.classList.toggle('playing', playing);
    document.title = r.title;
    if (id === 'start') this.start.enter();
    else if (id === 'einstellungen') this.prefs.enter();
    else if (id === 'level') this.levels.enter();
    else if (playing) this.play.enter(r.n ?? 1);
    else this.locked.enter(r.n);
    // Der Browser springt sonst zum Element mit der id aus dem Hash (der Karte der Lektion)
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (moved) {
      if (playing) this.play.focus();
      else this.section(id).querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
    }
    this.request();
    // Außerhalb einer Lektion ein sicherer Moment für eine neue Version der App (pwa-register.ts)
    if (!playing) this.dispatchEvent(new CustomEvent(SAFE_EVENT, { bubbles: true }));
  }

  /** Für Updates der App (pwa-register.ts): Was im Spiel gerade los ist; entschieden wird in pwa-update.ts */
  updateMoment(): GameMoment {
    const none = { won: false, menuOpen: false, resume: null };
    return { screen: this.shown, ...(this.shown === 'spiel' ? this.play.moment() : none) };
  }

  /** Für die Browser-Tests: wohin tippen, um ein Bodenfeld oder eine Kiste des Spielfelds zu treffen */
  spot(s: Spot) {
    return this.shown === 'spiel' ? this.play.spot(s) : null;
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

  /**
   * Ein Bild: die Szene des sichtbaren Bildschirms (auch von der Test-Uhr gerufen). Im Spiel ein Takt; läuft danach
   * noch etwas (Animation, Puffer, Konfetti), folgt das nächste Bild. Mit Test-Uhr ruft der Test jedes Bild selbst
   */
  frame() {
    if (!this.globals) return;
    let more = false;
    if (this.shown === 'start') this.start.draw();
    else if (this.shown === 'einstellungen') this.prefs.draw();
    else if (this.shown === 'level') this.levels.draw();
    else if (this.shown === 'spiel') more = this.play.frame(performance.now());
    if (more && !this.manual) this.request();
    if (this.classList.contains('settled')) return;
    if (this.manual) this.classList.add('settled');
    else requestAnimationFrame(() => this.classList.add('settled'));
  }
}

if (!customElements.get('ks-kistenschieber')) customElements.define('ks-kistenschieber', KsKistenschieber);
