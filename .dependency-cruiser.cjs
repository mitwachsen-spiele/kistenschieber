// Architekturregeln (Guard-Gate, `npm run arch`): die Schichten der Seite, maschinell geprüft.
//   src/lib       generische Bausteine (Würfel-Grafik beim Build, Spiel-Bausteine) – kennt keine Seiteninhalte
//   src/data      Inhalte und Konfiguration der Seite – nutzt lib, kennt keine Oberfläche
//   src/scripts   Code im Browser – aus lib nur src/lib/games und src/lib/voxel/textures.ts, nichts aus Node, kein sharp
//   src/lib/games, src/data/games – Bausteine und Inhalte des Spiels (Regeln, Löser, Lektionen), laufen im Browser
//   src/lib/pwa   Manifest und Service Worker der App – nur beim Build (Node), nie aus Browser-Code oder Spieldaten
//   src/integrations, components, layouts, pages – Build und Oberfläche, dürfen alles darunter nutzen
// Tests importiert kein Produktionscode. Die Gates in scripts/ (Node, nach dem Build) liegen außerhalb von src.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Zyklen machen Module untrennbar und die Ladereihenfolge zufällig.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'lib-is-generic',
      severity: 'error',
      comment: 'src/lib ist der generische Unterbau. Inhalte kommen als Parameter, nicht per Import.',
      from: { path: '^src/lib/' },
      to: { path: '^src/(data|components|layouts|pages|scripts)/' },
    },
    {
      name: 'data-knows-no-ui',
      severity: 'error',
      comment: 'Daten und Konfiguration hängen nicht von Komponenten, Layouts oder Seiten ab.',
      from: { path: '^src/data/' },
      to: { path: '^src/(components|layouts|pages|scripts)/' },
    },
    {
      name: 'client-gets-only-browser-lib',
      severity: 'error',
      comment:
        'Browser-Code nutzt aus lib nur die Texturen (textures.ts, reine Daten) und die Spiel-Bausteine (lib/games). Alles andere ist Build-Code und gehört nicht ins Bundle.',
      from: { path: '^src/scripts/', pathNot: '\\.test\\.ts$' },
      // Reine Typ-Importe verschwinden beim Kompilieren und sind erlaubt
      to: {
        path: '^src/lib/',
        pathNot: '^src/lib/(voxel/textures\\.ts|games/)',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'games-lib-is-browser-safe',
      severity: 'error',
      comment: 'lib/games läuft im Browser: keine Node-Module und aus lib nur die Texturen.',
      from: { path: '^src/lib/games/', pathNot: '\\.test\\.ts$' },
      to: { path: '^src/lib/', pathNot: '^src/lib/(games/|voxel/textures\\.ts)', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'games-data-is-browser-safe',
      severity: 'error',
      comment:
        'Spieldaten werden vom Browser-Code geladen: Sie dürfen aus lib nur lib/games und die Texturen nutzen, sonst rutscht Build-Code ins Bundle.',
      from: { path: '^src/data/games/', pathNot: '\\.test\\.ts$' },
      to: {
        path: '^src/(lib/(?!games/|voxel/textures\\.ts)|data/(?!games/))',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'no-node-in-games',
      severity: 'error',
      comment: 'Spiel-Bausteine und Spieldaten laufen im Browser und können keine Node-Module laden.',
      from: { path: '^src/(lib|data)/games/', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-node-in-client',
      severity: 'error',
      comment: 'Browser-Code kann weder Node-Module noch sharp laden.',
      from: { path: '^src/scripts/', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-sharp-in-client',
      severity: 'error',
      comment: 'sharp läuft nur beim Build.',
      from: { path: '^src/(scripts|lib/games|data/games)/', pathNot: '\\.test\\.ts$' },
      to: { path: 'sharp' },
    },
    {
      name: 'pwa-lib-is-build-only',
      severity: 'error',
      comment:
        'src/lib/pwa (Manifest, Liste und Quelltext des Service Workers) läuft nur beim Build in Node; Browser-Code und Spieldaten nutzen es nie.',
      from: { path: '^src/(scripts|data/games)/', pathNot: '\\.test\\.ts$' },
      to: { path: '^src/lib/pwa/' },
    },
    {
      name: 'no-test-in-production',
      severity: 'error',
      comment: 'Tests werden nur von Tests importiert.',
      from: { pathNot: '\\.test\\.ts$' },
      to: { path: '\\.test\\.ts$' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Jeder Import muss auflösbar sein (Astro-Module wie astro:content ausgenommen).',
      from: {},
      to: { couldNotResolve: true, pathNot: '^astro:' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(dist|\\.astro)/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // Paket-Unterpfade wie astro/zod über das exports-Feld auflösen
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types', 'default'] },
  },
};
