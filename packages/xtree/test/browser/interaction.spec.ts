import { expect, test } from './test.js';
import { diff, openFixture } from './fixture.js';

// Animation bindings (X14.3–X14.6) and HoloCSS stage interop (X15.4, X15.5).
test.beforeEach(async ({ page }) => openFixture(page));

test('bindings follow the pointer, orientation, scroll and audio, and rest', async ({
  page,
}) => {
  const r = await page.evaluate(() => window.xt.animationBindings());
  // Pointer: fine pointers drive the value (UV, origin bottom left); touch doesn't; leaving rests.
  if (r.fine) {
    expect(r.followed[0]).toBeCloseTo(0.8, 1);
    expect(r.followed[1]).toBeCloseTo(0.25, 1);
  }
  expect(r.touched).toEqual(r.followed);
  expect(r.rested).toEqual([0.5, 0.5]);
  // Orientation: the first reading is neutral; 15° of gamma is a quarter of the 60° range.
  expect(r.neutral[0]).toBeCloseTo(0.5, 2);
  expect(r.tilted[0]).toBeCloseTo(0.75, 2);
  expect(r.restored).toEqual([0.5, 0.5]);
  // Scroll: 500 of 1000 pixels of range is halfway, natively or sampled.
  expect(r.scrolled).toBeCloseTo(0.5, 1);
  expect(r.sampled).toBeCloseTo(0.25, 1);
  // Audio: a bass tone raises the value, which returns when unbound.
  expect(r.audio).toBeGreaterThan(0.05);
  expect(r.audioStopped).toBe(0);
});

test('effects render on a HoloCSS stage without a second context, and its ambient scenes', async ({
  page,
}) => {
  const r = await page.evaluate(() => window.xt.holocssStage());
  expect(r.drew).toBe(true);
  expect(r.size[0]).toBeGreaterThan(0);
  expect(r.extraContexts).toBe(0);
  // Inverting changes most of the frame.
  expect(r.stageDiffers).toBeGreaterThan(0.5);
  // Destroying the stage disposed the composer, and rendering then stops.
  expect(r.disposed).toBe(true);
  expect(r.afterDestroy).toBe(false);
  // The vignette darkens the gradient scene's corners.
  expect(r.ambientDiffers).toBeGreaterThan(0.05);
});

test('the same seed renders the same frames, another seed a different pattern (X14.7)', async ({
  page,
}) => {
  const render = (id: string, seed: number) =>
    page
      .evaluate(
        (s) =>
          window.xt.renderFloat({
            toneMapping: 'none',
            effects: [{ id: s.id, params: { seed: s.seed } }],
          }),
        { id, seed },
      )
      .then((r) => r.pixels);
  for (const id of [
    'film-grain',
    'frosted-glass',
    'heat-haze',
    'watercolor',
    'digital-noise',
    'displacement-map',
  ]) {
    const a = await render(id, 0);
    const again = await render(id, 0);
    const other = await render(id, 7);
    expect(diff(a, again, 1).maxChannel, id).toBe(0);
    expect(diff(a, other, 1).maxChannel, id).toBeGreaterThan(2);
  }
});
