import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOME_TITLE, HOME_URL, SITE, SKY_1, SKY_2, THEME_DARK, THEME_LIGHT, WELTENBUMMLER_URL } from './site';

describe('Seitendaten', () => {
  it('Titel der Startseite nennt den Namen und passt ins Suchergebnis', () => {
    expect(HOME_TITLE).toContain(SITE.title);
    expect(HOME_TITLE.length).toBeLessThanOrEqual(60);
  });

  it('alle Adressen liegen unter mitwachsen-spiele.de', () => {
    for (const url of [SITE.url, HOME_URL, WELTENBUMMLER_URL])
      expect(new URL(url).hostname.endsWith('.mitwachsen-spiele.de')).toBe(true);
  });

  it('Farben stimmen mit den Design-Tokens überein', () => {
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    expect(tokens).toContain(`--sky-1: ${SKY_1};`);
    expect(tokens).toContain(`--sky-2: ${SKY_2};`);
  });

  it('Browserleiste: hell Wasserblau, dunkel der Nachthimmel der Spielseite', () => {
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    expect(tokens).toContain(`--water-1: ${THEME_LIGHT};`);
    const dark = tokens.slice(tokens.indexOf('prefers-color-scheme: dark'));
    expect(dark).toContain(`--sky: ${THEME_DARK};`);
    expect(tokens.slice(tokens.indexOf("[data-theme='dark']"))).toContain(`--sky: ${THEME_DARK};`);
  });

  it('Beschreibung ohne Platzhalter, Titel der Startseite ist der Name', () => {
    expect(SITE.description).not.toMatch(/bald/);
    expect(SITE.description.length).toBeLessThanOrEqual(160);
    expect(HOME_TITLE).toBe(SITE.title);
  });
});
