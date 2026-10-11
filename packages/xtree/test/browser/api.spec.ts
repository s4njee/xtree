import { expect, test } from './test.js';
import { openFixture } from './fixture.js';

// The composer's API surface, interaction inputs, the debug overlay and the
// GPU timer (X18.1: these are what line coverage of src/core found untested).
test.beforeEach(async ({ page }) => openFixture(page));

test('composer stack, options, clock and errors', async ({ page }) => {
  const log = await page.evaluate(() => window.xt.composerApi());
  expect(log.noScene).toMatch(/setScene/);
  expect(log.effects).toEqual([
    'vignette',
    'monochrome',
    'chromatic-aberration',
  ]);
  expect(log.duplicate).toMatch(/appears twice/);
  expect(log.afterRemove).toBe(2);
  // A three.js pass splits the stack and shows in describe().
  expect(log.describe).toEqual([
    { label: 'pass 0', effects: ['vignette'], compiles: 1 },
    { label: 'pass 1', effects: ['ShaderPass'], compiles: 0 },
    { label: 'pass 2', effects: ['chromatic-aberration'], compiles: 1 },
  ]);
  expect(log.passes).toBe(3);
  // Disabling it drops it from the plan, and the image is no longer inverted.
  expect(log.passesDisabled).toBe(2);
  expect(log.invertChanged).toBe(true);
  expect(log.unmerged).toEqual({ merge: false, passes: 2 });
  expect(log.merged).toBe(1);
  expect(log.dithering).toBe(true);
  expect(log.playing).toEqual([false, true, false]);
  expect(log.progressNaN).toBe(0);
  expect(log.progressHigh).toBe(1);
  expect(log.driveInitial).toBe(0.25);
  expect(log.driveUpdate).toBe(0.75);
  expect(log.driveStopped).toBe(true);
  expect((log.timing as { on: boolean }).on).toBe(true);
  expect(log.timingOff).toBeNull();
  expect(log.bufferSize).toEqual({ width: 320, height: 180 });
  expect(log.withBuffers).toMatchObject({ prepasses: 2, depth: true });
  expect(log.withoutBuffers).toMatchObject({ prepasses: 0, depth: false });
  expect(log.afterDispose).toMatch(/after dispose/);
});

test('pointer, scroll and audio inputs', async ({ page, browserName }) => {
  const result = await page.evaluate(() => window.xt.interaction());
  expect(result.pointer[0]).toBeCloseTo(0.25, 2);
  expect(result.pointer[1]).toBeCloseTo(0.75, 2);
  // Moving right gives a positive x velocity, which settles to zero when still.
  expect(result.velocity[0]).toBeGreaterThan(0);
  expect(result.velocity[1]).toBeCloseTo(0, 5);
  expect(result.settled).toEqual([0, 0]);
  // Stopped trackers ignore later events.
  expect(result.afterStop[0]).toBeCloseTo(0.5, 2);
  expect(result.pageScroll).toBeGreaterThan(0.4);
  expect(result.pageScroll).toBeLessThan(0.6);
  expect(result.elementScroll).toBeGreaterThan(0);
  expect(result.elementScroll).toBeLessThan(1);
  for (const value of result.audio) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
  // A 110 Hz tone is bass (where the browser lets audio run unattended).
  if (browserName === 'chromium')
    expect(result.audio[0]).toBeGreaterThan(result.audio[2]!);
  expect(result.audioStopped).toEqual([0, 0, 0, 0]);
});

test('the debug overlay lists passes and restores timing', async ({ page }) => {
  const result = await page.evaluate(() => window.xt.debugOverlay());
  expect(result.text).toMatch(/\d+ fps · \d+ draws · \d+ programs/);
  expect(result.text).toMatch(/pass 0: bloom \+ vignette · 1 compile/);
  expect(result.timingOn).toBe(true);
  expect(result.timingAfter).toBe(false);
  expect(result.source).toBe(true);
  expect(result.missing).toBe('');
  expect(result.removed).toBe(true);
});

test('the GPU timer collects resolved frames and drops stale ones', async ({
  page,
}) => {
  const result = await page.evaluate(() => window.xt.gpuTimer());
  expect(result.supported).toBe(true);
  // Nested spans run but aren't measured twice.
  expect(result.nested).toBe(1);
  expect(result.pending).toEqual({});
  expect(result.ready).toEqual({ 'span 0': 3, 'span 1': 4 });
  // Unresolved frames are capped instead of piling up.
  expect(result.capped).toBeGreaterThan(0);
  // A disjoint frame is discarded without replacing the last good result.
  expect(result.afterDisjoint).toEqual(result.ready);
  expect(result.unsupported).toEqual({ supported: false, ran: 1 });
});

test('transition textures, material errors and resized prepasses', async ({
  page,
}) => {
  const result = await page.evaluate(() => window.xt.edgeCases());
  expect(result.swapped).toBe(true);
  expect(result.unsupported).toMatch(/ShaderMaterial is not supported/);
  expect(result.listed).toEqual(['hologram']);
  expect(result.twice).toMatch(/already patched/);
  expect(result.afterUnpatch).toBe(0);
  expect(result.unknown).toBe(0);
  expect(result.sizes).toEqual({
    resized: { width: 200, height: 100 },
    restored: { width: 320, height: 180 },
  });
  expect(result.spriteVisible).toBe(true);
});
