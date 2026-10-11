import { describe, expect, it } from 'vitest';
import {
  animate,
  cssEase,
  timeline,
  type Scheduler,
} from '../../src/animation/index.js';
import {
  color,
  defineEffect,
  float,
  int,
  select,
  vec2,
} from '../../src/effect/index.js';

const demo = defineEffect({
  name: 'demo-anim',
  meta: {
    title: 'Demo',
    family: 'color',
    story: 'X0.0',
    description: 'Test effect.',
  },
  params: {
    amount: float({ default: 0, min: 0, max: 10, description: '' }),
    count: int({ default: 0, min: 0, max: 10, description: '' }),
    tint: color({ default: '#000000', description: '' }),
    center: vec2({ default: [0, 0], min: -1, max: 1, description: '' }),
    mode: select({ options: ['a', 'b'], default: 'a', description: '' }),
  },
  fragment: 'vec4 $main(vec4 c, vec2 uv) { return c * $amount; }',
});

/** A manual clock: `advance(ms)` runs the frames due. */
function fakeClock() {
  let now = 0;
  let next = 1;
  const queue = new Map<number, () => void>();
  const scheduler: Scheduler = {
    now: () => now,
    request: (callback) => {
      queue.set(next, callback);
      return next++;
    },
    cancel: (handle) => void queue.delete(handle),
  };
  const advance = (ms: number, step = 16) => {
    for (let t = 0; t < ms; t += step) {
      now += Math.min(step, ms - t);
      const due = [...queue.values()];
      queue.clear();
      for (const callback of due) callback();
    }
  };
  return { scheduler, advance };
}

describe('cssEase', () => {
  it('handles keywords and cubic-bezier like CSS', () => {
    expect(cssEase('linear')(0.3)).toBeCloseTo(0.3);
    const ease = cssEase('ease');
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // CSS ease is well ahead of linear at the midpoint.
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
    expect(cssEase('cubic-bezier(0.42, 0, 0.58, 1)')(0.5)).toBeCloseTo(0.5, 4);
    expect(cssEase('ease-in')(0.5)).toBeCloseTo(0.3153, 3);
  });

  it('supports steps() with every jump position', () => {
    const end = cssEase('steps(4)');
    expect([0.1, 0.3, 0.6, 0.99].map(end)).toEqual([0, 0.25, 0.5, 0.75]);
    const start = cssEase('steps(4, jump-start)');
    expect([0.1, 0.3, 0.6, 0.99].map(start)).toEqual([0.25, 0.5, 0.75, 1]);
    const none = cssEase('steps(5, jump-none)');
    expect([0.1, 0.5, 0.9].map(none)).toEqual([0, 0.5, 1]);
    const both = cssEase('steps(3, jump-both)');
    expect([0.1, 0.5, 0.9].map(both)).toEqual([0.25, 0.5, 0.75]);
    expect(cssEase('step-end')(0.5)).toBe(0);
    expect(cssEase('step-start')(0.5)).toBe(1);
  });

  it('supports linear() stops with and without inputs', () => {
    const bounce = cssEase('linear(0, 0.8 40%, 0.6, 1)');
    expect(bounce(0.2)).toBeCloseTo(0.4);
    expect(bounce(0.4)).toBeCloseTo(0.8);
    // The unplaced 0.6 sits halfway between 40% and 100%.
    expect(bounce(0.7)).toBeCloseTo(0.6);
    expect(cssEase('linear(0, 0.25, 1)')(0.75)).toBeCloseTo(0.625);
  });

  it('falls back to linear for anything it does not understand', () => {
    for (const value of ['bogus', 'cubic-bezier(2, 0, 0, 1)', 'steps(0)'])
      expect(cssEase(value)(0.3)).toBeCloseTo(0.3);
  });
});

describe('animate', () => {
  it('tweens numbers, ints, colors and vectors, and switches other values at the end', async () => {
    const effect = demo();
    const { scheduler, advance } = fakeClock();
    const run = animate(
      effect,
      { amount: 10, count: 10, tint: '#ffffff', center: [1, -1], mode: 'b' },
      { duration: 1000, easing: 'linear', scheduler },
    );
    advance(500);
    expect(effect.amount).toBeCloseTo(5, 0);
    expect(effect.count).toBe(5);
    expect(effect.center[0]).toBeCloseTo(0.5, 1);
    // Halfway in linear light is brighter than halfway in sRGB.
    expect(Number.parseInt(effect.tint.slice(1, 3), 16)).toBeGreaterThan(160);
    expect(effect.mode).toBe('a');
    advance(600);
    expect(await run.finished).toBe('finished');
    expect(effect.amount).toBe(10);
    expect(effect.mode).toBe('b');
  });

  it('honours delay, cancels on abort and when a newer animation takes over', async () => {
    const effect = demo();
    const { scheduler, advance } = fakeClock();
    const controller = new AbortController();
    const first = animate(
      effect,
      { amount: 10 },
      {
        duration: 1000,
        delay: 200,
        easing: 'linear',
        scheduler,
        signal: controller.signal,
      },
    );
    advance(100);
    expect(effect.amount).toBe(0);
    advance(400);
    controller.abort();
    expect(await first.finished).toBe('canceled');
    const held = effect.amount;
    advance(500);
    expect(effect.amount).toBe(held);
    const second = animate(effect, { amount: 0 }, { duration: 100, scheduler });
    const third = animate(effect, { amount: 4 }, { duration: 100, scheduler });
    expect(await second.finished).toBe('canceled');
    advance(200);
    expect(await third.finished).toBe('finished');
    expect(effect.amount).toBe(4);
  });

  it('jumps to the end without motion', async () => {
    const effect = demo();
    const run = animate(effect, { amount: 3 }, { motion: false });
    expect(effect.amount).toBe(3);
    expect(await run.finished).toBe('finished');
  });

  it('names an unknown parameter', () => {
    expect(() => animate(demo(), { nope: 1 })).toThrow(
      /demo-anim: no parameter "nope"/,
    );
  });
});

describe('timeline', () => {
  it('scrubs keyframes across several effects with per-segment easing', () => {
    const a = demo();
    const b = demo();
    const story = timeline([
      {
        target: a,
        keyframes: [
          { at: 0, values: { amount: 0 } },
          { at: 0.5, values: { amount: 10 }, easing: 'steps(2)' },
          { at: 1, values: { amount: 0 } },
        ],
      },
      {
        target: b,
        keyframes: [
          { at: 0.5, values: { count: 2 } },
          { at: 1, values: { count: 6 } },
        ],
      },
    ]);
    expect(a.amount).toBe(0);
    expect(b.count).toBe(2);
    story.progress = 0.25;
    expect(a.amount).toBeCloseTo(5);
    story.progress = 0.6;
    // steps(2) from 0.5: the first step holds 10.
    expect(a.amount).toBe(10);
    expect(b.count).toBe(3);
    story.progress = 2;
    expect(story.progress).toBe(1);
    expect(a.amount).toBe(0);
    expect(b.count).toBe(6);
  });
});
