import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { EffectSpec, MaskSpec, RenderSpec } from '../fixtures/main.js';

export type { EffectSpec, MaskSpec, RenderSpec };

/** Opens the GPU fixture page. */
export async function openFixture(page: Page): Promise<void> {
  await page.goto('http://localhost:5179/');
  await expect(page.locator('body[data-ready]')).toBeAttached();
}

export const png = (dataUrl: string) =>
  Buffer.from(dataUrl.split(',')[1]!, 'base64');

/** Encoded sRGB in [0, 1] to CIE L*a*b* (D65). */
function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = Math.min(1, Math.max(0, c));
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export interface PixelDiff {
  /** Largest CIE76 ΔE between corresponding pixels. */
  maxDeltaE: number;
  /** The 99.9th percentile of ΔE across pixels. */
  deltaE999: number;
  /** Largest absolute 8-bit channel difference. */
  maxChannel: number;
  /** Fraction of pixels whose channels differ by more than 2 levels. */
  over2: number;
}

/**
 * Compares two RGBA pixel arrays. 8-bit arrays use `scale` 255; float arrays
 * (already display encoded) use 1.
 */
export function diff(
  a: readonly number[],
  b: readonly number[],
  scale = 255,
): PixelDiff {
  expect(a.length).toBe(b.length);
  let maxDeltaE = 0;
  let maxChannel = 0;
  let over2 = 0;
  const deltas: number[] = [];
  for (let i = 0; i < a.length; i += 4) {
    const d =
      (255 / scale) *
      Math.max(
        Math.abs(a[i]! - b[i]!),
        Math.abs(a[i + 1]! - b[i + 1]!),
        Math.abs(a[i + 2]! - b[i + 2]!),
      );
    maxChannel = Math.max(maxChannel, d);
    if (d > 2) over2++;
    if (d > 0) {
      const p = lab(a[i]! / scale, a[i + 1]! / scale, a[i + 2]! / scale);
      const q = lab(b[i]! / scale, b[i + 1]! / scale, b[i + 2]! / scale);
      const deltaE = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      maxDeltaE = Math.max(maxDeltaE, deltaE);
      deltas.push(deltaE);
    }
  }
  const pixels = a.length / 4;
  deltas.sort((x, y) => y - x);
  const deltaE999 = deltas[Math.floor(pixels * 0.001)] ?? 0;
  return { maxDeltaE, deltaE999, maxChannel, over2: over2 / pixels };
}

const baselineRoot = new URL('./__baselines__/', import.meta.url);

/** Pixelmatch's perceptual (YIQ) threshold and the share of pixels allowed past it. */
const tolerance = { maxDiffPixelRatio: 0.01, threshold: 0.12 };

/**
 * Compares a PNG with its visual baseline in `__baselines__/<browser>/`
 * (X18.3). A browser without its own baseline yet is compared with
 * Chromium's. `pnpm test:visual --update` writes the running browser's own.
 */
export function expectImage(image: Buffer, name: string): void {
  const info = test.info();
  const browser = info.project.name;
  const updating =
    info.config.updateSnapshots === 'all' ||
    info.config.updateSnapshots === 'changed';
  const own = existsSync(new URL(`${browser}/${name}`, baselineRoot));
  const folder = updating || own ? browser : 'chromium';
  expect.soft(image, name).toMatchSnapshot([folder, name], tolerance);
}
