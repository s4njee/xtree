import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  color,
  defineEffect,
  float,
  hexToLinear,
  int,
  select,
  vec2,
} from '../../src/effect/index.js';

const demo = defineEffect({
  name: 'demo-effect',
  meta: {
    title: 'Demo',
    family: 'color',
    story: 'X0.0',
    description: 'Test effect.',
  },
  params: {
    amount: float({ default: 0.5, min: 0, max: 1, description: 'Amount.' }),
    count: int({
      default: 3,
      min: 1,
      max: 8,
      structural: true,
      description: 'Count.',
    }),
    tint: color({ default: '#ffffff', description: 'Tint.' }),
    center: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      description: 'Center.',
    }),
    mode: select({
      options: ['soft', 'hard'],
      default: 'soft',
      description: 'Mode.',
    }),
  },
  presets: { strong: { amount: 1, mode: 'hard' } },
  motion: { settle: { amount: 0, count: 1 } },
  fragment: 'vec4 $main(vec4 color, vec2 uv) { return color * $amount; }',
});

describe('defineEffect', () => {
  it('creates instances with defaults and typed accessors', () => {
    const effect = demo();
    expect(effect.amount).toBe(0.5);
    expect(effect.mode).toBe('soft');
    expect(effect.center).toEqual([0.5, 0.5]);
    expectTypeOf(effect.amount).toEqualTypeOf<number>();
    expectTypeOf(effect.mode).toEqualTypeOf<'soft' | 'hard'>();
    expectTypeOf(effect.center).toEqualTypeOf<readonly [number, number]>();
  });

  it('keeps uniforms in sync without changing the structure for uniform parameters', () => {
    const effect = demo();
    const version = effect.structureVersion;
    effect.amount = 0.25;
    effect.tint = '#ff0000';
    effect.mode = 'hard';
    expect(effect.uniforms.amount!.value).toBe(0.25);
    expect(effect.uniforms.tint!.value).toEqual([1, 0, 0]);
    expect(effect.uniforms.mode!.value).toBe(1);
    expect(effect.structureVersion).toBe(version);
    effect.count = 5;
    expect(effect.structureVersion).toBe(version + 1);
    expect(effect.structuralValues()).toEqual({ count: 5 });
  });

  it('rejects invalid values, naming effect and parameter, without partial updates', () => {
    const effect = demo();
    expect(() => effect.set({ amount: 0.2, count: 99 })).toThrow(
      new RangeError('demo-effect.count: 99 is outside [1, 8]'),
    );
    expect(effect.amount).toBe(0.5);
    expect(() => effect.set({ amount: Number.NaN })).toThrow(TypeError);
    expect(() => effect.set({ tint: 'red' })).toThrow(
      /demo-effect\.tint: expected a hex color/,
    );
    expect(() => effect.set({ mode: 'medium' as 'soft' })).toThrow(
      /expected one of soft, hard/,
    );
    expect(() =>
      effect.set({ center: [0.5] as unknown as [number, number] }),
    ).toThrow(/expected 2 finite numbers/);
    expect(() => effect.set({ nope: 1 } as never)).toThrow(
      /unknown parameter nope/,
    );
  });

  it('applies presets over the defaults and reports changes', () => {
    const effect = demo({ count: 4 });
    effect.applyPreset('strong');
    expect(effect.count).toBe(3);
    expect(effect.changed()).toEqual({ amount: 1, mode: 'hard' });
    expect(effect.toJSON()).toEqual({
      effect: 'demo-effect',
      params: { amount: 1, mode: 'hard' },
    });
    expect(() => effect.applyPreset('missing')).toThrow(
      /unknown preset missing/,
    );
    expect(demo({ preset: 'strong', amount: 0.75 }).amount).toBe(0.75);
  });

  it('serializes blend, opacity and enabled state', () => {
    const effect = demo({ blend: 'screen', opacity: 0.5, enabled: false });
    expect(effect.toJSON()).toEqual({
      effect: 'demo-effect',
      blend: 'screen',
      opacity: 0.5,
      enabled: false,
    });
    expect(() => (effect.opacity = 2)).toThrow(RangeError);
    expect(() => (effect.blend = 'nope' as 'normal')).toThrow(
      /unknown blend mode/,
    );
  });

  it('settles parameters when motion is off without changing stored values', () => {
    const effect = demo({ amount: 0.8, count: 6 });
    const version = effect.structureVersion;
    effect.setMotion(false);
    expect(effect.uniforms.amount!.value).toBe(0);
    expect(effect.structuralValues()).toEqual({ count: 1 });
    expect(effect.structureVersion).toBe(version + 1);
    expect(effect.amount).toBe(0.8);
    effect.amount = 0.9;
    expect(effect.uniforms.amount!.value).toBe(0);
    effect.setMotion(true);
    expect(effect.uniforms.amount!.value).toBe(0.9);
    expect(effect.structuralValues()).toEqual({ count: 6 });
  });

  it('disposes once', () => {
    const effect = demo();
    let calls = 0;
    effect.onDispose(() => calls++);
    effect.dispose();
    effect.dispose();
    expect(calls).toBe(1);
    expect(effect.disposed).toBe(true);
  });

  it('validates definitions', () => {
    const base = {
      meta: demo.definition.meta,
      fragment: 'vec4 $main(vec4 c, vec2 uv) { return c; }',
    };
    expect(() =>
      defineEffect({ ...base, name: 'Bad Name', params: {} }),
    ).toThrow(/kebab-case/);
    expect(() =>
      defineEffect({
        ...base,
        name: 'x',
        params: {
          blend: float({ default: 0, min: 0, max: 1, description: '' }),
        },
      }),
    ).toThrow(/reserved/);
    expect(() =>
      defineEffect({
        ...base,
        name: 'x',
        params: { a: float({ default: 2, min: 0, max: 1, description: '' }) },
      }),
    ).toThrow(RangeError);
    expect(() =>
      defineEffect({
        ...base,
        name: 'x',
        params: { a: float({ default: 0, min: 0, max: 1, description: '' }) },
        presets: { p: { b: 1 } as never },
      }),
    ).toThrow(/unknown parameter b/);
    expect(() =>
      defineEffect({
        ...base,
        name: 'x',
        params: {},
        fragment: 'void main() {}',
      }),
    ).toThrow(/\$main/);
  });

  it('converts hex colors to linear RGB like three.js', () => {
    const [r, g, b] = hexToLinear('#808080');
    expect(r).toBeCloseTo(0.2158605, 6);
    expect(g).toBe(r);
    expect(b).toBe(r);
    expect(hexToLinear('#f00')).toEqual([1, 0, 0]);
  });
});
