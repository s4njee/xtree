import { expect, test } from './test.js';
import { openFixture } from './fixture.js';

test.beforeEach(async ({ page }) => openFixture(page));

// "#fff" → "#ffffff"; other syntaxes (oklch, color-mix) are left to the browser.
const normalize = (value: string) =>
  /^#[0-9a-f]{3}$/i.test(value)
    ? `#${[...value.slice(1)].map((c) => c + c).join('')}`.toLowerCase()
    : value.toLowerCase();

test.describe('HoloCSS round trip (X15.2, X15.3)', () => {
  test('every HoloCSS theme re-themes bound effects and the accent live', async ({
    page,
  }) => {
    const result = await page.evaluate(() => window.xt.holocssRoundTrip());
    expect(result.themes).toHaveLength(17);
    expect(result.roles).toEqual({
      outline: { color: 'accent', paper: 'background' },
      'depth-fog': { color: 'surface' },
      'gradient-map': {
        shadows: 'background',
        midtones: 'accent',
        highlights: 'text',
      },
      'holographic-foil': { tint: 'accent' },
    });
    for (const row of result.themes) {
      const { resolved, effects, theme } = row;
      for (const role of ['accent', 'background', 'surface', 'text'] as const) {
        expect(resolved[role], `${theme} ${role}`).toMatch(/^#[0-9a-f]{6}$/);
        const token = normalize(row.tokens[role]!);
        if (/^#[0-9a-f]{6}$/.test(token))
          expect(resolved[role], `${theme} ${role}`).toBe(token);
      }
      expect(effects.outline, theme).toEqual({
        color: resolved.accent,
        paper: resolved.background,
      });
      expect(effects['depth-fog'], theme).toEqual({ color: resolved.surface });
      expect(effects['gradient-map'], theme).toEqual({
        shadows: resolved.background,
        midtones: resolved.accent,
        highlights: resolved.text,
      });
      expect(effects['holographic-foil'], theme).toEqual({
        tint: resolved.accent,
      });
      expect(row.accent, theme).toBe(resolved.accent);
      // HoloCSS's runtime turns motion off for the high-contrast theme.
      expect(row.motion, theme).toBe(theme !== 'high-contrast');
    }
    // The themes really differ, so the bindings did follow them.
    const accents = new Set(result.themes.map((t) => t.resolved.accent));
    expect(accents.size).toBeGreaterThan(8);
    expect(result.motionNone).toBe(false);
    expect(result.motionRestored).toBe(true);
    // After unbinding, a theme change no longer reaches the effects.
    const dark = result.themes.find((t) => t.theme === 'dark')!;
    expect(result.afterUnbind).toEqual(dark.effects.outline);
  });

  test('reduced motion stops bound composers under every theme', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const result = await page.evaluate(() => window.xt.holocssRoundTrip());
    for (const row of result.themes) expect(row.motion, row.theme).toBe(false);
    expect(result.motionRestored).toBe(false);
  });
});
