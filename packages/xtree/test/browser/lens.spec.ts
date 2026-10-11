import { expect, test } from './test.js';
import { diff, openFixture, type EffectSpec } from './fixture.js';

// The P1 lens and blur effects (X4.6–X4.11, X5.5–X5.9) and the velocity
// buffer they introduce (the rest of X1.6).
test.beforeEach(async ({ page }) => openFixture(page));

test.describe('velocity buffer', () => {
  test('reports object motion in UV per frame, and none on the first frame', async ({
    page,
  }) => {
    const r = await page.evaluate(() =>
      window.xt.velocityProbe({ move: [0.4, 0, 0] }),
    );
    expect(r.firstKnot![0]).toBeCloseTo(0, 3);
    expect(r.firstKnot![1]).toBeCloseTo(0, 3);
    // The knot moved right by the projected amount.
    expect(r.knot![0]).toBeCloseTo(r.expected![0]!, 2);
    expect(Math.abs(r.knot![1]! - r.expected![1]!)).toBeLessThan(0.01);
    // The still floor did not move.
    expect(Math.abs(r.floor![0]!)).toBeLessThan(1e-3);
    expect(Math.abs(r.floor![1]!)).toBeLessThan(1e-3);
  });

  test('includes camera motion', async ({ page }) => {
    const r = await page.evaluate(() =>
      window.xt.velocityProbe({ cameraMove: [0.3, 0, 0] }),
    );
    // Moving the camera right moves everything left on screen.
    expect(r.floor![0]).toBeLessThan(-0.005);
    expect(r.knot![0]).toBeLessThan(-0.005);
  });
});

test('motion blur smears moving objects and leaves still frames alone', async ({
  page,
}) => {
  const still = await page.evaluate(() =>
    window.xt.renderFloat({ toneMapping: 'none' }),
  );
  const blurredStill = await page.evaluate(() =>
    window.xt.renderFloat({
      toneMapping: 'none',
      effects: [{ id: 'motion-blur' }],
    }),
  );
  // Nothing moves between renders, so the image is unchanged.
  expect(diff(still.pixels, blurredStill.pixels, 1).maxChannel).toBeLessThan(
    0.6,
  );
  const moving = await page.evaluate(() =>
    window.xt.velocityProbe({
      move: [0.6, 0, 0],
      effect: { id: 'motion-blur', params: { intensity: 1, samples: 16 } },
    }),
  );
  const sharp = await page.evaluate(() =>
    window.xt.velocityProbe({
      move: [0.6, 0, 0],
      effect: { id: 'motion-blur', params: { intensity: 0 } },
    }),
  );
  const d = diff(sharp.pixels!, moving.pixels!, 1);
  // Edges of the moving knot are smeared; most of the frame is still.
  expect(d.maxChannel).toBeGreaterThan(20);
  expect(d.over2).toBeLessThan(0.25);
});

test('neutral settings leave the image unchanged', async ({ page }) => {
  const neutral: EffectSpec[] = [
    { id: 'radial-blur', params: { strength: 0 } },
    { id: 'directional-blur', params: { length: 0 } },
    { id: 'bokeh-blur', params: { radius: 0 } },
    { id: 'fisheye', params: { strength: 0 } },
    { id: 'fisheye', params: { projection: 'panini', strength: 0 } },
    { id: 'lens-flare', params: { intensity: 0 } },
    { id: 'anamorphic', params: { intensity: 0 } },
    { id: 'star-streaks', params: { intensity: 0 } },
    { id: 'halation', params: { intensity: 0 } },
    { id: 'lens-dirt', params: { intensity: 0 } },
  ];
  const { pixels: plain } = await page.evaluate(() =>
    window.xt.renderFloat({ toneMapping: 'none' }),
  );
  for (const spec of neutral) {
    const { pixels } = await page.evaluate(
      (s) => window.xt.renderFloat({ toneMapping: 'none', effects: [s] }),
      spec,
    );
    expect(
      diff(plain, pixels, 1).maxChannel,
      `${spec.id} ${JSON.stringify(spec.params)}`,
    ).toBeLessThan(1);
  }
});

test('glow effects add light only from highlights', async ({ page }) => {
  const total = (pixels: number[]) => {
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4)
      sum += pixels[i]! + pixels[i + 1]! + pixels[i + 2]!;
    return sum;
  };
  const plain = total(
    (await page.evaluate(() => window.xt.renderFloat({ toneMapping: 'none' })))
      .pixels,
  );
  for (const id of [
    'lens-flare',
    'anamorphic',
    'star-streaks',
    'halation',
    'lens-dirt',
  ]) {
    const lit = total(
      (
        await page.evaluate(
          (i) =>
            window.xt.renderFloat({
              toneMapping: 'none',
              effects: [{ id: i as never }],
            }),
          id,
        )
      ).pixels,
    );
    expect(lit, id).toBeGreaterThan(plain * 1.001);
    // A threshold above every pixel adds nothing.
    const none = total(
      (
        await page.evaluate(
          (i) =>
            window.xt.renderFloat({
              toneMapping: 'none',
              // Above every pixel in the scene (whose brightest is about 7).
              effects: [
                {
                  id: i as never,
                  // Bloom-based effects also have a soft knee below the threshold.
                  params:
                    i === 'halation' || i === 'lens-dirt'
                      ? { threshold: 8, knee: 0 }
                      : { threshold: 8 },
                },
              ],
            }),
          id,
        )
      ).pixels,
    );
    expect(none / plain, id).toBeLessThan(1.002);
  }
});

test('blurs spread a bright edge', async ({ page }) => {
  // Neighboring pixels differ less after any blur.
  const roughness = (pixels: number[]) => {
    let sum = 0;
    for (let i = 4; i < pixels.length; i += 4)
      sum += Math.abs(pixels[i]! - pixels[i - 4]!);
    return sum;
  };
  const plain = roughness(
    (await page.evaluate(() => window.xt.renderFloat({ toneMapping: 'none' })))
      .pixels,
  );
  for (const spec of [
    { id: 'radial-blur', params: { strength: 0.3 } },
    { id: 'directional-blur', params: { length: 40 } },
    { id: 'bokeh-blur', params: { radius: 10, highlights: 0 } },
    { id: 'frosted-glass', params: { grain: 0, distortion: 0 } },
  ] as EffectSpec[]) {
    const r = roughness(
      (
        await page.evaluate(
          (s) => window.xt.renderFloat({ toneMapping: 'none', effects: [s] }),
          spec,
        )
      ).pixels,
    );
    expect(r, spec.id).toBeLessThan(plain * 0.8);
  }
});
