import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOME_TITLE, HOME_URL, SITE, SKY_1, SKY_2, WELTENBUMMLER_URL } from './site';

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
});
