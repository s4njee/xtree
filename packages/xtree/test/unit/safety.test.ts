import { describe, expect, it } from 'vitest';
import { analyseFlashes, type FlashFrame } from '../../src/safety/index.js';

const width = 64;
const height = 36;

/** A sequence at `fps` where `paint(frame, x, y)` gives each pixel's sRGB color. */
function sequence(
  frames: number,
  paint: (frame: number, x: number, y: number) => [number, number, number],
): FlashFrame[] {
  return Array.from({ length: frames }, (_, f) => {
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const [r, g, b] = paint(f, x, y);
        pixels.set([r, g, b, 255], (y * width + x) * 4);
      }
    return { width, height, pixels };
  });
}

const strobe = (hz: number, fps: number) => (f: number) =>
  Math.floor((f * hz * 2) / fps) % 2 === 0;

describe('analyseFlashes (X16.3)', () => {
  it('fails a full-frame strobe above three flashes a second', () => {
    const on = strobe(5, 30);
    const report = analyseFlashes(
      sequence(60, (f) => (on(f) ? [255, 255, 255] : [0, 0, 0])),
      { fps: 30 },
    );
    expect(report.generalPerSecond).toBeGreaterThanOrEqual(4);
    expect(report.pass).toBe(false);
  });

  it('passes a two-flash-a-second strobe and a slow fade', () => {
    const on = strobe(2, 30);
    expect(
      analyseFlashes(
        sequence(60, (f) => (on(f) ? [255, 255, 255] : [0, 0, 0])),
        { fps: 30 },
      ).pass,
    ).toBe(true);
    const fade = analyseFlashes(
      sequence(60, (f) => {
        const v = Math.round(127 + 127 * Math.sin((f / 60) * Math.PI));
        return [v, v, v];
      }),
      { fps: 30 },
    );
    // One slow rise and fall over two seconds is at most one flash.
    expect(fade.generalPerSecond).toBeLessThanOrEqual(1);
    expect(fade.pass).toBe(true);
  });

  it('ignores fast flashing in a small area', () => {
    const on = strobe(8, 30);
    const report = analyseFlashes(
      sequence(60, (f, x, y) =>
        x < 4 && y < 4 && on(f) ? [255, 255, 255] : [0, 0, 0],
      ),
      { fps: 30 },
    );
    expect(report.pass).toBe(true);
  });

  it('catches red flashes that are too dark to count as general flashes', () => {
    const on = strobe(5, 30);
    const report = analyseFlashes(
      sequence(60, (f) => (on(f) ? [110, 0, 0] : [0, 0, 0])),
      { fps: 30 },
    );
    expect(report.generalPerSecond).toBe(0);
    expect(report.redPerSecond).toBeGreaterThanOrEqual(4);
    expect(report.pass).toBe(false);
  });
});
