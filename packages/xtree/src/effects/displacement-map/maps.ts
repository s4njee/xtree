/**
 * Tileable displacement maps generated on demand. Red and green hold two
 * independent fields centered on 0.5; blue holds their average so the map
 * also works in luminance mode.
 */

const size = 256;

/** Deterministic integer hash to [0, 1). */
function hash(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x, 0x27d4eb2d) ^
    Math.imul(y, 0x165667b1) ^
    Math.imul(seed, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise with a lattice of `period` cells that wraps at the texture edge. */
function valueNoise(
  u: number,
  v: number,
  period: number,
  seed: number,
): number {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (i: number, j: number) =>
    hash(
      ((i % period) + period) % period,
      ((j % period) + period) % period,
      seed,
    );
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}

function build(
  field: (u: number, v: number, channel: number) => number,
): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const r = field(u, v, 0);
      const g = field(u, v, 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round(Math.min(Math.max(r, 0), 1) * 255);
      data[i + 1] = Math.round(Math.min(Math.max(g, 0), 1) * 255);
      data[i + 2] = Math.round((data[i]! + data[i + 1]!) / 2);
      data[i + 3] = 255;
    }
  }
  return data;
}

const cache = new Map<string, Uint8Array>();
const cached = (name: string, make: () => Uint8Array) => {
  let data = cache.get(name);
  if (!data) cache.set(name, (data = make()));
  return data;
};

/** Four octaves of tileable value noise in red and green. */
export const noiseMapTexels = (): Uint8Array =>
  cached('noise', () =>
    build((u, v, channel) => {
      let sum = 0;
      let amplitude = 0.5;
      for (let octave = 0; octave < 4; octave++) {
        sum +=
          amplitude * valueNoise(u, v, 4 << octave, channel * 31 + octave + 1);
        amplitude *= 0.5;
      }
      return 0.5 + (sum / 0.9375 - 0.5) * 1.6;
    }),
  );

/** Crossed sine waves, like light through a rippled glass pane. */
export const wavesMapTexels = (): Uint8Array =>
  cached('waves', () =>
    build((u, v, channel) => {
      const t = 2 * Math.PI;
      return channel === 0
        ? 0.5 +
            0.35 * Math.sin(t * (3 * v + 0.15 * Math.sin(t * 2 * u))) +
            0.1 * Math.sin(t * 7 * u)
        : 0.5 +
            0.35 * Math.sin(t * (3 * u + 0.15 * Math.sin(t * 2 * v))) +
            0.1 * Math.sin(t * 5 * v);
    }),
  );

export const mapSize = size;
