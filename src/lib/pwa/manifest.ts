// Web-App-Manifest (manifest.webmanifest): macht die Seite installierbar („Zum Home-Bildschirm“). Generisch – Name,
// Farben und Icons kommen als Parameter.

export type AppIcon = {
  file: string; // Dateiname im Wurzelverzeichnis, z. B. "icon-192.png"
  size: number;
  purpose: 'any' | 'maskable';
};

export type AppInfo = {
  name: string;
  shortName: string;
  description: string;
  lang: string;
  startUrl: string;
  scope: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  themeColor: string;
  backgroundColor: string;
};

export function webManifest(app: AppInfo, icons: AppIcon[]) {
  return {
    id: app.startUrl,
    name: app.name,
    short_name: app.shortName,
    description: app.description,
    lang: app.lang,
    dir: 'ltr',
    start_url: app.startUrl,
    scope: app.scope,
    display: app.display,
    // Keine "orientation": Das Spiel dreht sich mit dem Gerät
    theme_color: app.themeColor,
    background_color: app.backgroundColor,
    icons: icons.map((i) => ({
      src: `/${i.file}`,
      sizes: `${i.size}x${i.size}`,
      type: 'image/png',
      purpose: i.purpose,
    })),
  };
}
