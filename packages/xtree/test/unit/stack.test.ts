import { describe, expect, it, vi } from 'vitest';
import {
  bakeCurve,
  bakeGradient,
  curve,
  decodeStack,
  defineEffect,
  EffectStack,
  encodeStack,
  gradient,
  stackFromJSON,
  stackToJSON,
} from '../../src/effect/index.js';
import { bloom } from '../../src/effects/bloom/index.js';
import { monochrome } from '../../src/effects/monochrome/index.js';
import { vignette } from '../../src/effects/vignette/index.js';

const registry = { bloom, monochrome, vignette };

describe('stack serialization (X1.12)', () => {
  it('round-trips to identical uniforms', () => {
    const effects = [
      vignette({ preset: 'cinematic', blend: 'multiply', opacity: 0.7 }),
      monochrome({ mode: 'duotone', mask: { depth: [2, 9], feather: 1 } }),
      bloom({ intensity: 2.5, enabled: false }),
    ];
    const restored = stackFromJSON(decodeStack(encodeStack(effects)), registry);
    expect(restored.map((e) => e.name)).toEqual([
      'vignette',
      'monochrome',
      'bloom',
    ]);
    restored.forEach((effect, i) => {
      const original = effects[i]!;
      for (const [name, uniform] of Object.entries(original.uniforms))
        expect(effect.uniforms[name]!.value, `${effect.name}.${name}`).toEqual(
          uniform.value,
        );
      expect(effect.blend).toBe(original.blend);
      expect(effect.enabled).toBe(original.enabled);
      expect(effect.mask).toEqual(original.mask);
    });
    expect(stackToJSON(restored)).toEqual(stackToJSON(effects));
  });

  it('warns about and skips unknown effects, parameters and keys', () => {
    const warn = vi.fn();
    const effects = EffectStack.fromJSON(
      {
        version: 1,
        effects: [
          { effect: 'nope' },
          {
            effect: 'vignette',
            params: { darkness: 0.9, sparkle: 3 },
            extra: true,
          } as never,
        ],
      },
      registry,
      { warn },
    );
    expect(effects).toHaveLength(1);
    expect(effects[0]!.get('darkness' as never)).toBe(0.9);
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      'xtree: stack entry 0: unknown effect nope',
      'xtree: vignette: ignoring unknown key extra',
      'xtree: vignette: ignoring unknown parameter sparkle',
    ]);
  });

  it('encodes URL-safe strings and rejects garbage', () => {
    const text = encodeStack([vignette({ darkness: 0.77 })]);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(() => decodeStack('not-a-stack')).toThrow(SyntaxError);
  });
});

describe('gradient and curve parameters (X1.1)', () => {
  const probe = defineEffect({
    name: 'probe',
    meta: { title: 'P', family: 'color', story: 'X1.1', description: 'P.' },
    params: {
      ramp: gradient({
        default: [
          [0, '#000000'],
          [1, '#ffffff'],
        ],
        description: 'R.',
      }),
      shape: curve({
        default: [
          [0, 0],
          [0.5, 0.8],
          [1, 1],
        ],
        description: 'S.',
      }),
    },
    fragment:
      'vec4 $main(vec4 c, vec2 uv) { return texture($ramp, vec2(texture($shape, vec2(uv.x, 0.5)).r, 0.5)); }',
  });

  it('validate stops and points', () => {
    const effect = probe();
    expect(() => effect.set({ ramp: [[0, '#000']] })).toThrow(/at least two/);
    expect(() =>
      effect.set({
        ramp: [
          [0.5, '#000'],
          [0.2, '#fff'],
        ],
      }),
    ).toThrow(/increase/);
    expect(() =>
      effect.set({
        ramp: [
          [0, 'red'],
          [1, '#fff'],
        ],
      }),
    ).toThrow(/hex/);
    expect(() =>
      effect.set({
        shape: [
          [0, 0],
          [0, 1],
        ],
      }),
    ).toThrow(/increase/);
    expect(() =>
      effect.set({
        shape: [
          [0, 0],
          [1, 2],
        ],
      }),
    ).toThrow(/\[0, 1\]/);
    effect.set({
      ramp: [
        [0, '#f00'],
        [0.5, '#0f0'],
        [1, '#00f'],
      ],
    });
    expect(effect.changed()).toEqual({
      ramp: [
        [0, '#f00'],
        [0.5, '#0f0'],
        [1, '#00f'],
      ],
    });
    effect.reset();
    expect(effect.changed()).toEqual({});
  });

  it('bake gradients in sRGB and curves without overshoot', () => {
    const g = bakeGradient([
      [0, '#000000'],
      [1, '#ffffff'],
    ]);
    expect(g.kind === 'data2d' && g.width).toBe(256);
    const data = g.data as Float32Array;
    // Halfway in sRGB is #808080, about 0.216 linear.
    expect(data[127 * 4]!).toBeCloseTo(0.212, 2);
    expect(data[255 * 4]!).toBeCloseTo(1, 5);
    const c = bakeCurve([
      [0, 0],
      [0.3, 0.9],
      [0.6, 0.95],
      [1, 1],
    ]).data as Float32Array;
    let previous = -1;
    for (let i = 0; i < 256; i++) {
      const v = c[i * 4]!;
      expect(v).toBeGreaterThanOrEqual(previous - 1e-6);
      expect(v).toBeLessThanOrEqual(1 + 1e-6);
      previous = v;
    }
    expect(c[Math.round(0.3 * 255) * 4]!).toBeCloseTo(0.9, 1);
  });

  it('bake and dispose a texture per value', () => {
    const effect = probe();
    const created: { disposed: boolean }[] = [];
    const create = () => {
      const t = {
        isTexture: true as const,
        disposed: false,
        dispose() {
          t.disposed = true;
        },
      };
      created.push(t);
      return t;
    };
    effect.resolveSamples(create);
    effect.resolveSamples(create);
    expect(created).toHaveLength(2);
    effect.set({
      ramp: [
        [0, '#ff0000'],
        [1, '#0000ff'],
      ],
    });
    effect.resolveSamples(create);
    expect(created).toHaveLength(3);
    expect(created[0]!.disposed).toBe(true);
    effect.dispose();
    expect(created.every((t) => t.disposed)).toBe(true);
  });
});
