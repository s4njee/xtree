// Double-precision CPU references for the color and blend chunks.

export type Vec3 = [number, number, number];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const map = (c: Vec3, f: (v: number, i: number) => number): Vec3 => [
  f(c[0], 0),
  f(c[1], 1),
  f(c[2], 2),
];
const mul = (rows: [Vec3, Vec3, Vec3], c: Vec3): Vec3 => [
  dot(rows[0], c),
  dot(rows[1], c),
  dot(rows[2], c),
];
const mod = (x: number, y: number) => x - y * Math.floor(x / y);
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const srgbToLinear = (c: Vec3) =>
  map(c, (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
export const linearToSrgb = (c: Vec3) =>
  map(c, (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));

function hue(c: Vec3, max: number, d: number): number {
  if (d <= 1e-7) return 0;
  let h: number;
  if (max === c[0]) h = mod((c[1] - c[2]) / d, 6);
  else if (max === c[1]) h = (c[2] - c[0]) / d + 2;
  else h = (c[0] - c[1]) / d + 4;
  return h / 6;
}

export function rgbToHsv(c: Vec3): Vec3 {
  const max = Math.max(...c);
  const d = max - Math.min(...c);
  return [hue(c, max, d), max > 1e-7 ? d / max : 0, max];
}

export function rgbToHsl(c: Vec3): Vec3 {
  const max = Math.max(...c);
  const min = Math.min(...c);
  const d = max - min;
  const l = (max + min) / 2;
  return [
    hue(c, max, d),
    d > 1e-7 ? d / Math.max(1 - Math.abs(2 * l - 1), 1e-7) : 0,
    l,
  ];
}

const toLms: [Vec3, Vec3, Vec3] = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const lmsToLab: [Vec3, Vec3, Vec3] = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
export const linearToOklab = (c: Vec3) =>
  mul(lmsToLab, map(mul(toLms, c), Math.cbrt));

export function oklabToOklch(c: Vec3): Vec3 {
  const chroma = Math.hypot(c[1], c[2]);
  return [
    c[0],
    chroma,
    chroma > 1e-7 ? mod(Math.atan2(c[2], c[1]) / (2 * Math.PI), 1) : 0,
  ];
}

export const rgbToYiq = (c: Vec3) =>
  mul(
    [
      [0.299, 0.587, 0.114],
      [0.5959, -0.2746, -0.3213],
      [0.2115, -0.5227, 0.3112],
    ],
    c,
  );

export function rgbToYuv(c: Vec3): Vec3 {
  const y = dot(c, [0.2126, 0.7152, 0.0722]);
  return [y, (c[2] - y) / 1.8556, (c[0] - y) / 1.5748];
}

/** Planckian locus xy, Kim et al. 2002, as in xt_planckianXy. */
export function planckianXy(kelvin: number): [number, number] {
  const k = clamp(kelvin, 1667, 25000);
  const x =
    k <= 4000
      ? -0.2661239e9 / k ** 3 - 0.2343589e6 / k ** 2 + 0.8776956e3 / k + 0.17991
      : -3.0258469e9 / k ** 3 +
        2.1070379e6 / k ** 2 +
        0.2226347e3 / k +
        0.24039;
  const y =
    k <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : k <= 4000
        ? -0.9549476 * x ** 3 -
          1.37418593 * x ** 2 +
          2.09137015 * x -
          0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

/** White point as in xt_whitePointXy: the locus shifted to pass through D65 at 6500 K. */
export function whitePointXy(kelvin: number, tint: number): [number, number] {
  const [px, py] = planckianXy(kelvin);
  const [ox, oy] = planckianXy(6500);
  const x = px + 0.3127266 - ox;
  const y = py + 0.3290231 - oy;
  const [x1, y1] = planckianXy(kelvin + 50);
  const [x0, y0] = planckianXy(kelvin - 50);
  let nx = -(y1 - y0);
  let ny = x1 - x0;
  const length = Math.hypot(nx, ny);
  nx /= length;
  ny /= length;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return [x + nx * tint * 0.05, y + ny * tint * 0.05];
}

function invert([[a, b, c], [d, e, f], [g, h, i]]: [Vec3, Vec3, Vec3]): [
  Vec3,
  Vec3,
  Vec3,
] {
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

/** Linear sRGB to XYZ (D65), the matrix the white-balance chunk is built from. */
const srgbToXyz: [Vec3, Vec3, Vec3] = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const xyzToSrgb = invert(srgbToXyz);

/** Linear sRGB of a chromaticity at luminance 1. */
export function xyToLinearSrgb([x, y]: [number, number]): Vec3 {
  return mul(xyzToSrgb, [x / y, 1, (1 - x - y) / y]);
}

// Blend modes, mirroring W3C Compositing and Blending Level 1.
const lum = (c: Vec3) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
function clipColor(c: Vec3): Vec3 {
  const l = lum(c);
  const n = Math.min(...c);
  const x = Math.max(...c);
  let out = c;
  if (n < 0) out = map(out, (v) => l + ((v - l) * l) / Math.max(l - n, 1e-6));
  if (x > 1)
    out = map(out, (v) => l + ((v - l) * (1 - l)) / Math.max(x - l, 1e-6));
  return out;
}
const setLum = (c: Vec3, l: number) =>
  clipColor(map(c, (v) => v + (l - lum(c))));
const sat = (c: Vec3) => Math.max(...c) - Math.min(...c);
function setSat(c: Vec3, s: number): Vec3 {
  const max = Math.max(...c);
  const min = Math.min(...c);
  const range = max - min;
  return range > 1e-6 ? map(c, (v) => ((v - min) * s) / range) : [0, 0, 0];
}

const burn = (b: number, s: number) =>
  b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / Math.max(s, 1e-6));
const dodge = (b: number, s: number) =>
  b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / Math.max(1 - s, 1e-6));
const hardLight = (b: number, s: number) =>
  s <= 0.5 ? b * 2 * s : b + (2 * s - 1) - b * (2 * s - 1);
function softLight(b: number, s: number) {
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(Math.max(b, 0));
  return clamp(
    s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (d - b),
  );
}

type Separable = (b: number, s: number) => number;
const separable: Record<string, Separable> = {
  normal: (_b, s) => s,
  darken: Math.min,
  multiply: (b, s) => b * s,
  colorBurn: (b, s) => clamp(burn(b, s)),
  linearBurn: (b, s) => clamp(b + s - 1),
  lighten: Math.max,
  screen: (b, s) => b + s - b * s,
  colorDodge: (b, s) => clamp(dodge(b, s)),
  add: (b, s) => b + s,
  overlay: (b, s) => hardLight(s, b),
  softLight,
  hardLight,
  vividLight: (b, s) =>
    s <= 0.5 ? clamp(burn(b, 2 * s)) : clamp(dodge(b, 2 * s - 1)),
  linearLight: (b, s) => clamp(b + 2 * s - 1),
  pinLight: (b, s) =>
    clamp(s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)),
  hardMix: (b, s) => (Math.fround(b + s) >= 1 ? 1 : 0),
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s,
  subtract: (b, s) => Math.max(b - s, 0),
  divide: (b, s) => clamp(s <= 0 ? (b >= 1e-6 ? 1 : 0) : b / Math.max(s, 1e-6)),
};

export function blendReference(mode: string, base: Vec3, blend: Vec3): Vec3 {
  const fn = separable[mode];
  if (fn) return map(base, (b, i) => fn(b, blend[i]!));
  switch (mode) {
    case 'darkerColor':
      return lum(blend) < lum(base) ? blend : base;
    case 'lighterColor':
      return lum(blend) > lum(base) ? blend : base;
    case 'hue':
      return setLum(setSat(blend, sat(base)), lum(base));
    case 'saturation':
      return setLum(setSat(base, sat(blend)), lum(base));
    case 'color':
      return setLum(blend, lum(base));
    case 'luminosity':
      return setLum(base, lum(blend));
    default:
      throw new Error(`no reference for ${mode}`);
  }
}
