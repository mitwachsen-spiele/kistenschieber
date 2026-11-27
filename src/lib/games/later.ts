// Nachladen bei Bedarf: eine Datei erst holen, wenn sie das erste Mal gebraucht wird (`import()`), bis dahin nichts.
// Scheitert das Holen (ohne Netz und noch nicht gespeichert), bleibt es still, bis die Seite neu lädt. Generisch.

/**
 * Liefert eine Funktion, die beim ersten Aufruf mit wahrem `want` `load` startet (nur einmal) und dann liefert, was es
 * geladen hat, auch ohne `want`; bis dahin, und wenn das Laden scheitert, undefined
 */
export function later<T>(load: () => Promise<T>): (want: unknown) => T | undefined {
  let got: T | undefined;
  let asked = false;
  return (want) => {
    if (want && !asked) {
      asked = true;
      load().then(
        (m) => (got = m),
        () => undefined,
      );
    }
    return got;
  };
}
