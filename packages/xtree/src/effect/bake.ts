/**
 * Bakes gradient and curve parameters into texture data. Only the composer
 * (and tools) import this, so effect bundles don't carry it.
 */
import type { CurvePoints, GradientStops, SampleTexture } from './params.js';

type DataSample = Extract<SampleTexture, { kind: 'data2d' }>;

/** Texels in a baked gradient or curve. */
const bakeSize = 256;

/** Bakes gradient stops into a 256×1 linear-color texture, interpolating in sRGB like CSS gradients. */
export function bakeGradient(stops: GradientStops): DataSample {
  const data = new Float32Array(bakeSize * 4);
  const encoded = stops.map(([position, hex]) => {
    const full =
      hex.length === 4
        ? `#${[...hex.slice(1)].map((c) => c + c).join('')}`
        : hex;
    const value = Number.parseInt(full.slice(1), 16);
    return [
      position,
      [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(
        (c) => c / 255,
      ),
    ] as const;
  });
  const linear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  for (let i = 0; i < bakeSize; i++) {
    const t = i / (bakeSize - 1);
    let k = encoded.findIndex(([position]) => position >= t);
    if (k === -1) k = encoded.length - 1;
    const [p1, c1] = encoded[k]!;
    const [p0, c0] = encoded[Math.max(0, k - 1)]!;
    const f = p1 > p0 ? Math.min(1, Math.max(0, (t - p0) / (p1 - p0))) : 1;
    for (let c = 0; c < 3; c++)
      data[i * 4 + c] = linear(c0[c]! + (c1[c]! - c0[c]!) * f);
    data[i * 4 + 3] = 1;
  }
  return {
    kind: 'data2d',
    width: bakeSize,
    height: 1,
    data,
    filter: 'linear',
    wrap: 'clamp',
  };
}

/** Bakes curve points into a 256×1 texture (value in red) with monotone cubic interpolation (Fritsch–Carlson). */
export function bakeCurve(points: CurvePoints): DataSample {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const slopes = xs
    .slice(1)
    .map((x, i) => (ys[i + 1]! - ys[i]!) / (x - xs[i]!));
  const tangents = xs.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === n - 1) return slopes[n - 2]!;
    const a = slopes[i - 1]!;
    const b = slopes[i]!;
    return a * b <= 0
      ? 0
      : (3 * (xs[i + 1]! - xs[i - 1]!)) /
          ((2 * xs[i + 1]! - xs[i]! - xs[i - 1]!) / a +
            (xs[i + 1]! + xs[i]! - 2 * xs[i - 1]!) / b);
  });
  const data = new Float32Array(bakeSize * 4);
  for (let i = 0; i < bakeSize; i++) {
    const x = i / (bakeSize - 1);
    let value: number;
    if (x <= xs[0]!) value = ys[0]!;
    else if (x >= xs[n - 1]!) value = ys[n - 1]!;
    else {
      let k = 0;
      while (xs[k + 1]! < x) k++;
      const h = xs[k + 1]! - xs[k]!;
      const t = (x - xs[k]!) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      value =
        (2 * t3 - 3 * t2 + 1) * ys[k]! +
        (t3 - 2 * t2 + t) * h * tangents[k]! +
        (-2 * t3 + 3 * t2) * ys[k + 1]! +
        (t3 - t2) * h * tangents[k + 1]!;
    }
    data[i * 4] = value;
    data[i * 4 + 3] = 1;
  }
  return {
    kind: 'data2d',
    width: bakeSize,
    height: 1,
    data,
    filter: 'linear',
    wrap: 'clamp',
  };
}
