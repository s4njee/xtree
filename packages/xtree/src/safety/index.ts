/**
 * Photosensitivity analysis for rendered frames, after WCAG 2.3.1 (three
 * flashes or below threshold) and its general and red flash definitions.
 *
 * - A general flash is a pair of opposing changes in relative luminance of
 *   at least 0.1, where the darker state is below 0.8.
 * - A red flash is a pair of opposing transitions to or from saturated red
 *   (red at least 80% of R+G+B) whose (R − G − B) × 320 changes by more
 *   than 20.
 * - Flashes only count when they cover enough of the view at once: 25% of a
 *   10° visual field, which WCAG puts at 341 × 256 px of a 1024 × 768
 *   screen, so about 2.8% of the frame by default.
 * - Luminance is averaged over small cells first (1/40 of the width), as
 *   flash analysis works on areas rather than single pixels.
 * - More than three flashes of either kind in any one-second window fails.
 *
 * This is a development and CI tool; it is not a substitute for a full
 * Harding or PEAT analysis of finished content.
 *
 * @module safety
 */

/** One rendered frame: RGBA8 pixels, display-encoded (sRGB). */
export interface FlashFrame {
  readonly width: number;
  readonly height: number;
  readonly pixels: ArrayLike<number>;
}

/** How `analyseFlashes` reads a frame sequence. */
export interface FlashOptions {
  /** Frames per second of the sequence. */
  readonly fps: number;
  /** Fraction of the frame that must flash together to count. Defaults to 341×256 / 4 of 1024×768 ≈ 0.0278. */
  readonly area?: number;
  /** Allowed flashes per second. Defaults to 3 (WCAG 2.3.1). */
  readonly limit?: number;
  /**
   * Size in pixels of the square cells luminance is averaged over first, so
   * fine noise that averages out isn't counted. Defaults to 1/40 of the width.
   */
  readonly cell?: number;
}

/** The result of `analyseFlashes`: the worst one-second windows and whether they pass. */
export interface FlashReport {
  /** Largest number of general flashes in any one-second window. */
  readonly generalPerSecond: number;
  /** Largest number of red flashes in any one-second window. */
  readonly redPerSecond: number;
  /** Frame indices where a counted general or red flash completed. */
  readonly flashFrames: readonly number[];
  readonly pass: boolean;
}

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const table = Array.from({ length: 256 }, (_, i) => linear(i));

/** Frames where enough pixels completed a flash (per-pixel state: the last transition's direction and the extreme since). */
/** Averages each frame's linear RGB over square cells, as flash analysis works on areas, not single pixels. */
function cellAverages(
  frames: readonly FlashFrame[],
  cell: number,
): Float32Array[] {
  const { width, height } = frames[0]!;
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  return frames.map(({ pixels }) => {
    const sums = new Float32Array(columns * rows * 4);
    for (let y = 0; y < height; y++) {
      const row = Math.floor(y / cell) * columns;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const c = (row + Math.floor(x / cell)) * 4;
        sums[c] = sums[c]! + table[pixels[i]!]!;
        sums[c + 1] = sums[c + 1]! + table[pixels[i + 1]!]!;
        sums[c + 2] = sums[c + 2]! + table[pixels[i + 2]!]!;
        sums[c + 3] = sums[c + 3]! + 1;
      }
    }
    const out = new Float32Array(columns * rows * 3);
    for (let c = 0; c < columns * rows; c++) {
      const n = Math.max(sums[c * 4 + 3]!, 1);
      out[c * 3] = sums[c * 4]! / n;
      out[c * 3 + 1] = sums[c * 4 + 1]! / n;
      out[c * 3 + 2] = sums[c * 4 + 2]! / n;
    }
    return out;
  });
}

/** Frames where enough area completed a flash (per cell: the last transition's direction and the extreme since). */
function analyse(
  frames: readonly Float32Array[],
  measure: (r: number, g: number, b: number) => number,
  qualifies: (
    from: number,
    to: number,
    fromRgb: number[],
    toRgb: number[],
  ) => boolean,
  threshold: number,
): number[] {
  if (frames.length < 2) return [];
  const count = frames[0]!.length / 3;
  const anchor = new Float32Array(count);
  const anchorRgb = new Float32Array(count * 3);
  const direction = new Int8Array(count);
  const completed: number[] = [];
  const first = frames[0]!;
  for (let i = 0; i < count; i++) {
    anchor[i] = measure(first[i * 3]!, first[i * 3 + 1]!, first[i * 3 + 2]!);
    anchorRgb.set(first.subarray(i * 3, i * 3 + 3), i * 3);
  }
  for (let f = 1; f < frames.length; f++) {
    const frame = frames[f]!;
    let flashing = 0;
    for (let i = 0; i < count; i++) {
      const r = frame[i * 3]!;
      const g = frame[i * 3 + 1]!;
      const b = frame[i * 3 + 2]!;
      const value = measure(r, g, b);
      const from = anchor[i]!;
      const fromRgb = [
        anchorRgb[i * 3]!,
        anchorRgb[i * 3 + 1]!,
        anchorRgb[i * 3 + 2]!,
      ];
      // Transitions are measured from the extreme reached since the last one,
      // so a slow ramp is one transition, not many.
      if (qualifies(from, value, fromRgb, [r, g, b])) {
        const sign = value > from ? 1 : -1;
        // An opposing pair of transitions is one flash; the pair is then used up.
        if (direction[i] === -sign) {
          flashing++;
          direction[i] = 0;
        } else direction[i] = sign;
        anchor[i] = value;
        anchorRgb.set([r, g, b], i * 3);
      } else if (direction[i] !== 0 && (value - from) * direction[i]! > 0) {
        anchor[i] = value;
        anchorRgb.set([r, g, b], i * 3);
      }
    }
    if (flashing / count >= threshold) completed.push(f);
  }
  return completed;
}

function perSecond(frames: readonly number[], fps: number): number {
  let best = 0;
  for (let i = 0; i < frames.length; i++) {
    let n = 0;
    for (let j = i; j < frames.length && frames[j]! - frames[i]! < fps; j++)
      n++;
    best = Math.max(best, n);
  }
  return best;
}

/** Analyses a frame sequence for general and red flashes. */
export function analyseFlashes(
  frames: readonly FlashFrame[],
  options: FlashOptions,
): FlashReport {
  const area = options.area ?? (341 * 256) / 4 / (1024 * 768);
  const limit = options.limit ?? 3;
  if (frames.length < 2)
    return {
      generalPerSecond: 0,
      redPerSecond: 0,
      flashFrames: [],
      pass: true,
    };
  const cells = cellAverages(
    frames,
    options.cell ?? Math.max(1, Math.round(frames[0]!.width / 40)),
  );
  const luminance = (r: number, g: number, b: number) =>
    0.2126 * r + 0.7152 * g + 0.0722 * b;
  const general = analyse(
    cells,
    luminance,
    (from, to) => Math.abs(to - from) >= 0.1 && Math.min(from, to) < 0.8,
    area,
  );
  const saturatedRed = (rgb: number[]) =>
    rgb[0]! / Math.max(rgb[0]! + rgb[1]! + rgb[2]!, 1e-6) >= 0.8;
  const redness = (r: number, g: number, b: number) =>
    Math.max(r - g - b, 0) * 320;
  const red = analyse(
    cells,
    redness,
    (from, to, fromRgb, toRgb) =>
      Math.abs(to - from) > 20 &&
      (saturatedRed(fromRgb) || saturatedRed(toRgb)),
    area,
  );
  const generalPerSecond = perSecond(general, options.fps);
  const redPerSecond = perSecond(red, options.fps);
  return {
    generalPerSecond,
    redPerSecond,
    flashFrames: [...new Set([...general, ...red])].sort((a, b) => a - b),
    pass: generalPerSecond <= limit && redPerSecond <= limit,
  };
}
