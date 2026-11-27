// Bildschirm beim Spielen anlassen (Wake Lock), wo der Browser es erlaubt (wie im Entwurf): Auf dem Spielfeld und
// solange die Seite zu sehen ist, wird die Sperre angefordert; wird die Seite wieder sichtbar, erneut (der Browser gibt
// sie beim Verstecken selbst frei). Wer das Spielfeld verlässt, gibt sie frei. Fehler bleiben still (kein Wake Lock,
// abgelehnt, Akku-Sparmodus). Die Entscheidung `wantLock` ist rein, der Rest ein dünner Teil über Navigator und Dokument.

/** Gewollt nur auf dem Spielfeld und solange die Seite zu sehen ist */
export const wantLock = (screen: string, visible: boolean): boolean => screen === 'spiel' && visible;

/** Teil des WakeLockSentinel, den das Spiel braucht */
export interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', fn: () => void): void;
}

export interface WakeEnv {
  /** navigator.wakeLock.request('screen'); fehlt ohne Wake Lock */
  readonly request: (() => Promise<Sentinel>) | null;
  readonly visible: () => boolean;
}

const quiet = (s: Sentinel) => s.release().catch(() => undefined);

export class ScreenLock {
  private lock: Sentinel | null = null;
  private asking = false;
  private screen = '';

  constructor(private readonly env: WakeEnv) {}

  /** Bildschirm gewechselt */
  show(screen: string) {
    this.screen = screen;
    this.update();
  }

  /** Nach Bildschirmwechsel oder Sichtbarkeit: anfordern oder freigeben */
  update() {
    const want = wantLock(this.screen, this.env.visible());
    if (!want && this.lock) {
      const l = this.lock;
      this.lock = null;
      void quiet(l);
    }
    if (!want || this.lock || this.asking || !this.env.request) return;
    this.asking = true;
    this.env.request().then(
      (s) => {
        this.asking = false;
        // Inzwischen nicht mehr gewollt: gleich wieder freigeben
        if (!wantLock(this.screen, this.env.visible())) return void quiet(s);
        this.lock = s;
        s.addEventListener('release', () => {
          if (this.lock === s) this.lock = null;
        });
      },
      () => {
        this.asking = false;
      },
    );
  }

  /** Wird gerade eine Sperre gehalten? */
  get held(): boolean {
    return this.lock !== null;
  }
}

/** Wake Lock im Browser: Sichtbarkeit beobachten, bis `signal` endet */
export function watchWakeLock(signal: AbortSignal): ScreenLock {
  const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } }).wakeLock;
  const lock = new ScreenLock({
    request: wl ? () => wl.request('screen') : null,
    visible: () => document.visibilityState === 'visible',
  });
  document.addEventListener('visibilitychange', () => lock.update(), { signal });
  signal.addEventListener('abort', () => lock.show(''));
  return lock;
}
