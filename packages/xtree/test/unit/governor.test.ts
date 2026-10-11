import { describe, expect, it } from 'vitest';
import { FrameGovernor } from '../../src/core/governor.js';

// A synthetic GPU: a fixed cost plus a per-pixel cost that grows with the
// square of the resolution scale, times a factor per quality tier.
const gpu =
  (fixed: number, pixels: number) => (scale: number, quality: string) =>
    fixed +
    pixels *
      scale *
      scale *
      (quality === 'high' ? 1 : quality === 'medium' ? 0.6 : 0.35);

describe('FrameGovernor (X17.3)', () => {
  it('holds the frame time within 10% of the target under load', () => {
    for (const load of [20, 30, 45]) {
      const governor = new FrameGovernor({ targetMs: 16.7, minScale: 0.5 });
      const cost = gpu(2, load);
      let ms = 0;
      for (let frame = 0; frame < 120; frame++) {
        const { scale, quality } = governor.state;
        ms = cost(scale, quality);
        governor.update(ms);
      }
      expect(Math.abs(ms / 16.7 - 1), `load ${load}`).toBeLessThan(0.1);
    }
  });

  it('stays at full quality and scale when there is headroom, and recovers after a spike', () => {
    const governor = new FrameGovernor({ targetMs: 16.7 });
    for (let i = 0; i < 30; i++) governor.update(8);
    expect(governor.state).toEqual({ scale: 1, quality: 'high' });
    for (let i = 0; i < 40; i++) {
      const { scale, quality } = governor.state;
      // Even at half resolution this load misses the target at high quality.
      governor.update(gpu(2, 80)(scale, quality));
    }
    expect(governor.state.quality).not.toBe('high');
    // The load goes away: it climbs back to full quality.
    for (let i = 0; i < 80; i++) {
      const { scale, quality } = governor.state;
      governor.update(gpu(2, 8)(scale, quality));
    }
    expect(governor.state.quality).toBe('high');
  });

  it('recovers under vsync, where frame intervals never fall below the target', () => {
    const governor = new FrameGovernor({ targetMs: 16.7 });
    const vsync = (ms: number) => Math.max(ms, 16.7);
    for (let i = 0; i < 60; i++) {
      const { scale, quality } = governor.state;
      governor.update(vsync(gpu(2, 80)(scale, quality)));
    }
    expect(governor.state.quality).not.toBe('high');
    let worst = 0;
    for (let i = 0; i < 2000; i++) {
      const { scale, quality } = governor.state;
      const ms = vsync(gpu(2, 8)(scale, quality));
      if (i > 1500) worst = Math.max(worst, ms);
      governor.update(ms);
    }
    expect(governor.state).toEqual({ scale: 1, quality: 'high' });
    expect(worst / 16.7).toBeLessThan(1.1);
  });

  it('ignores invalid times and rejects invalid options', () => {
    const governor = new FrameGovernor();
    governor.update(Number.NaN);
    governor.update(-1);
    expect(governor.state.scale).toBe(1);
    expect(() => new FrameGovernor({ minScale: 2, maxScale: 1 })).toThrow(
      RangeError,
    );
  });
});
