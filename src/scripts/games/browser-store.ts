// Speicher des Spiels im Browser: localStorage, falls erlaubt – sonst ein Speicher, der nur bis zum Neuladen hält.
import type { Store } from './ks-save';

/** localStorage, falls erlaubt – sonst ein Speicher, der nur bis zum Neuladen hält (`persistent` false) */
export function browserStore(): { store: Store; persistent: boolean } {
  try {
    const s = window.localStorage;
    const probe = 'kistenschieber.probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return { store: s, persistent: true };
  } catch {
    const mem = new Map<string, string>();
    return {
      store: {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => void mem.set(k, v),
        removeItem: (k) => void mem.delete(k),
      },
      persistent: false,
    };
  }
}
