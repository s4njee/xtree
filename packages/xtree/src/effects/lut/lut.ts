import type { SampleTexture } from '../../effect/index.js';

/** A parsed 3D LUT: `size`³ RGBA texels with red varying fastest. */
export interface CubeLut {
  readonly title: string;
  readonly size: number;
  readonly data: Float32Array;
}

/** A color transform on display-encoded RGB in [0, 1]. */
export type LutFunction = (
  r: number,
  g: number,
  b: number,
) => readonly [number, number, number];

/**
 * Parses an Adobe/Resolve `.cube` file (3D LUTs only). Non-default
 * `DOMAIN_MIN`/`DOMAIN_MAX` are folded into the table, so the result always
 * covers [0, 1].
 */
export function parseCubeLut(text: string): CubeLut {
  let title = '';
  let size = 0;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  const values: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [keyword, ...rest] = line.split(/\s+/);
    if (keyword === 'TITLE') title = line.slice(5).trim().replace(/^"|"$/g, '');
    else if (keyword === 'LUT_3D_SIZE') size = Number(rest[0]);
    else if (keyword === 'LUT_1D_SIZE')
      throw new TypeError('parseCubeLut: 1D LUTs are not supported');
    else if (keyword === 'DOMAIN_MIN') domainMin = rest.map(Number);
    else if (keyword === 'DOMAIN_MAX') domainMax = rest.map(Number);
    else if (/^[-+.\d]/.test(keyword!))
      values.push(Number(keyword), ...rest.slice(0, 2).map(Number));
  }
  if (!Number.isInteger(size) || size < 2 || size > 256)
    throw new TypeError(`parseCubeLut: invalid LUT_3D_SIZE ${size}`);
  if (values.length !== size ** 3 * 3) {
    throw new TypeError(
      `parseCubeLut: expected ${size ** 3} entries, found ${values.length / 3}`,
    );
  }
  if (values.some((v) => !Number.isFinite(v)))
    throw new TypeError('parseCubeLut: non-numeric entry');
  const data = new Float32Array(size ** 3 * 4);
  for (let i = 0; i < size ** 3; i++) {
    for (let c = 0; c < 3; c++) {
      data[i * 4 + c] =
        (values[i * 3 + c]! - domainMin[c]!) / (domainMax[c]! - domainMin[c]!);
    }
    data[i * 4 + 3] = 1;
  }
  return { title, size, data };
}

/** Samples `fn` on a `size`³ grid into LUT data. */
export function generateLut(size: number, fn: LutFunction): Float32Array {
  const data = new Float32Array(size ** 3 * 4);
  const scale = 1 / (size - 1);
  let i = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const out = fn(r * scale, g * scale, b * scale);
        data.set([out[0], out[1], out[2], 1], i);
        i += 4;
      }
    }
  }
  return data;
}

const luma = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const sCurve = (v: number, k: number) =>
  clamp(v + k * v * (1 - v) * (2 * v - 1));
const saturate = (
  r: number,
  g: number,
  b: number,
  s: number,
): [number, number, number] => {
  const l = luma(r, g, b);
  return [
    clamp(l + (r - l) * s),
    clamp(l + (g - l) * s),
    clamp(l + (b - l) * s),
  ];
};

/** Built-in looks, as functions on display-encoded RGB. */
export const lutLooks = {
  identity: (r, g, b) => [r, g, b],
  /** Teal shadows, warm highlights and a gentle S-curve. */
  tealOrange: (r, g, b) => {
    const l = luma(r, g, b);
    const shift = (l - 0.5) * 0.14;
    const [sr, sg, sb] = saturate(r + shift, g + shift * 0.15, b - shift, 1.15);
    return [sCurve(sr, 0.5), sCurve(sg, 0.5), sCurve(sb, 0.5)];
  },
  /** Lifted blacks, warm cast, soft contrast. */
  warmFilm: (r, g, b) => {
    const lift = (v: number) => 0.06 + v * 0.9;
    const [sr, sg, sb] = saturate(r * 1.04, g, b * 0.9, 0.9);
    return [lift(sr), lift(sg), lift(sb)];
  },
  /** Blue night grade: darker and cooler, with desaturated shadows. */
  coolNight: (r, g, b) => {
    const [sr, sg, sb] = saturate(
      r * 0.82,
      g * 0.92,
      clamp(b * 1.05 + 0.03),
      0.75,
    );
    return [sr * 0.9, sg * 0.92, sb];
  },
  /** Bleach bypass: half the saturation and harder contrast. */
  bleachBypass: (r, g, b) => {
    const [sr, sg, sb] = saturate(r, g, b, 0.45);
    return [sCurve(sr, 0.9), sCurve(sg, 0.9), sCurve(sb, 0.9)];
  },
} satisfies Record<string, LutFunction>;

/** A 33³ sample texture for a look. */
export const lookSample =
  (fn: LutFunction): (() => SampleTexture) =>
  () => ({ kind: 'data3d', size: 33, data: generateLut(33, fn) });

/** Wraps a parsed `.cube` file as sample data (pass it to `createSampleTexture` from `@mk7s/xtree/core`). */
export const cubeSample = (lut: CubeLut): SampleTexture => ({
  kind: 'data3d',
  size: lut.size,
  data: lut.data,
});
