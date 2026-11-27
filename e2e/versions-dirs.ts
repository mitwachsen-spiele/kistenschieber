// Fassungen der Seite für den Browser-Test: 1 ist der Build, 2 leitet e2e/versions.ts daraus ab.
// Eigene Datei ohne Imports, damit der Test-Server (e2e/serve.ts, läuft direkt mit Node) sie lesen kann.
export const VERSIONS: Record<string, string> = { '1': 'dist', '2': '.e2e/v2' };

/**
 * Der per import() nachgeladene Teil ks-menu (Konfetti, Name mit Hash): Ihn holt eine Seite erst NACH dem Laden, mit
 * der ersten Lektion. Nur daran zeigt sich, dass ein alter Tab nach einem Update weiterspielt (seine alte Datei kommt
 * aus dem alten Cache); die Anmeldung pwa-register ist beim Laden schon da
 */
export const CHUNK = /^\/?_astro\/ks-menu\.[\w-]+\.js$/;
