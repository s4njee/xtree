import { describe, expect, it } from 'vitest';
import { toHoloEffect } from '../../src/core/transition.js';
import {
  compileHoloFragment,
  compileTransition,
} from '../../src/core/transition-compile.js';
import { defineTransition } from '../../src/effect/index.js';
import { crossfade } from '../../src/effects/crossfade/index.js';

describe('transitions', () => {
  it('validate their entry point and HoloCSS fallback', () => {
    const meta = {
      title: 'T',
      family: 'transition',
      story: 'X13',
      description: 'T.',
    } as const;
    expect(() =>
      defineTransition({
        name: 't',
        meta,
        params: {},
        fallback: 'hcss-depth',
        fragment: 'vec4 $main() {}',
      }),
    ).toThrow(/\$transition/);
    expect(() =>
      defineTransition({
        name: 't',
        meta,
        params: {},
        fallback: 'hcss-nope' as never,
        fragment: 'vec4 $transition(vec2 uv, float p) { return xt_from(uv); }',
      }),
    ).toThrow(/fallback/);
  });

  it('compile parameters as uniforms for the xtree runtime', () => {
    const t = crossfade({ softness: 0.3 });
    const compiled = compileTransition(t, { srgb: true });
    expect(compiled.fragment).toContain('uniform float t0_softness;');
    expect(compiled.fragment).toContain(
      't0_transition(vUv, clamp(progress, 0.0, 1.0))',
    );
    expect(compiled.fragment).toContain(
      'color.rgb = xt_linearToSrgb(color.rgb);',
    );
    expect(compiled.uniforms.t0_softness).toBe(t.uniforms.softness);
    expect(compileTransition(t, { srgb: false }).fragment).not.toContain(
      'color.rgb = xt_linearToSrgb',
    );
  });

  it('bake current values into the HoloCSS fragment', () => {
    const t = crossfade({ pattern: 'radial', softness: 0.3, invert: true });
    const fragment = compileHoloFragment(t);
    expect(fragment).toContain('#define t0_softness 0.3');
    expect(fragment).toContain('#define t0_invert true');
    expect(fragment).toContain('#define t0_pattern 3');
    expect(fragment).toContain('#define t0_has_luma 0');
    expect(fragment).toContain('#include <colorspace_fragment>');
    expect(fragment).toContain('uniform vec3 accent;');
    expect(fragment).not.toMatch(/uniform float t0_/);
    expect(fragment).not.toMatch(/#line|\$\w/);
  });

  it('toHoloEffect returns a ThreeEffect and rejects texture parameters', () => {
    const effect = toHoloEffect(crossfade());
    expect(effect).toEqual({
      name: 'Crossfade & luma wipe',
      fallback: 'hcss-depth',
      fragment: expect.stringContaining('void main()'),
    });
    expect(() =>
      toHoloEffect(crossfade({ luma: { isTexture: true } as never })),
    ).toThrow(/luma is a texture/);
  });
});
