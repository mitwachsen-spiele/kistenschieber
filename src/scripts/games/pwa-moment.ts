// Was das Spiel für App-Updates meldet – nur Daten und Typen, damit der Kern (ks-game.ts, ks-kistenschieber.ts) sie
// nutzen kann, ohne die Entscheidungen (pwa-update.ts) zu laden. Die kommen erst mit pwa-register.ts nach.
// Spezifikation: docs/specs/kistenschieber.md („App“).

export const WIN_MS = 2_000; // nach „Geschafft!“ erst das Konfetti (1,4 s) zu Ende fliegen lassen
/** So meldet das Spiel, dass ein sicherer Moment beginnt (steigt auf); `detail.after`: so viele ms später auslösen */
export const SAFE_EVENT = 'kistenschieber-ruhe';

/** Welcher Bildschirm zu sehen ist (ks-kistenschieber.ts) */
export type Screen = 'start' | 'level' | 'einstellungen' | 'gesperrt' | 'spiel';

/** Was das Spiel gerade tut, soweit es fürs Neuladen zählt */
export type Moment = {
  screen: Screen;
  won: boolean; // im Spiel steht „Geschafft!“ (selbst gelöst, nicht vorgespielt)
  menuOpen: boolean; // das Menü im Spiel ist offen
  persistent: boolean; // der Spielstand liegt im localStorage und übersteht das Neuladen
  visible: boolean;
};

/** Was das Spiel selbst beiträgt (ks-kistenschieber.ts); den Rest weiß die Seite. `resume`: Hash nach dem Neuladen */
export type GameMoment = Pick<Moment, 'screen' | 'won' | 'menuOpen'> & { resume: string | null };
