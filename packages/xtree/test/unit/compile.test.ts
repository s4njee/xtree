import { describe, expect, it } from 'vitest';
import {
  compilePass,
  passSignature,
  renameEffectSource,
} from '../../src/core/compile.js';
import { planPasses } from '../../src/core/plan.js';
import { bloom } from '../../src/effects/bloom/index.js';
import { chromaticAberration } from '../../src/effects/chromatic-aberration/index.js';
import { holographicFoil } from '../../src/effects/holographic-foil/index.js';
import { rgbSplitGlitch } from '../../src/effects/rgb-split-glitch/index.js';
import { vignette } from '../../src/effects/vignette/index.js';

describe('renameEffectSource', () => {
  it('prefixes $ names only', () => {
    expect(
      renameEffectSource(
        'vec4 $main(vec4 c) { return c * $amount + xt_x; }',
        'e3_',
      ),
    ).toBe('vec4 e3_main(vec4 c) { return c * e3_amount + xt_x; }');
  });
});

describe('compilePass', () => {
  it('declares uniforms, defines and main calls per effect', () => {
    const a = vignette();
    const b = vignette({ blend: 'multiply' });
    const { fragment, uniforms } = compilePass([a, b], null, 7);
    expect(fragment).toContain('// xtree-pass:7');
    expect(fragment).toContain('uniform float e0_darkness;');
    expect(fragment).toContain('uniform vec3 e1_color;');
    expect(fragment).toContain('#define e0_mode_eskil 1');
    expect(fragment).toContain('result = e1_main(color, uv);');
    expect(fragment).toContain(
      `result.rgb = xt_blend(2, color.rgb, result.rgb);`,
    );
    expect(fragment).not.toMatch(/\$\w/);
    expect(fragment).not.toMatch(/#include/);
    expect(uniforms.e0_darkness).toBe(a.uniforms.darkness);
    expect(uniforms.e1_opacity).toBe(b.uniforms.opacity);
  });

  it('compiles structural parameters as defines', () => {
    const effect = chromaticAberration({ samples: 8 });
    const { fragment, uniforms } = compilePass([effect], null);
    expect(fragment).toContain('#define e0_samples 8');
    expect(uniforms.e0_samples).toBeUndefined();
  });

  it('includes each chunk once across merged effects', () => {
    const { fragment } = compilePass(
      [holographicFoil(), rgbSplitGlitch(), holographicFoil()],
      null,
    );
    expect(fragment.match(/uint xt_pcg\(uint v\)/g)).toHaveLength(1);
    expect(fragment.match(/float xt_simplex\(vec3 p\)/g)).toHaveLength(1);
  });

  it('appends the output stage', () => {
    const { fragment } = compilePass([], {
      toneMapping: 'agx',
      colorSpace: 'srgb',
      dither: true,
    });
    expect(fragment).toContain(
      'color.rgb = xt_tonemapAgx(color.rgb, xt_exposure);',
    );
    expect(fragment).toContain('color.rgb = xt_linearToSrgb(color.rgb);');
    expect(fragment).toContain('xt_ign(gl_FragCoord.xy)');
    const linear = compilePass([], {
      toneMapping: 'none',
      colorSpace: 'linear',
      dither: false,
    }).fragment;
    expect(linear).not.toContain('xt_tonemap');
    expect(linear).not.toContain('xt_linearToSrgb(color');
  });

  it('declares texture uniforms for multi-pass effects', () => {
    const effect = bloom();
    const { fragment, uniforms } = compilePass([effect], null);
    expect(fragment).toContain('uniform sampler2D e0_bloom;');
    expect(uniforms.e0_bloom).toBe(effect.uniforms.bloom);
  });

  it('changes the signature only for structural changes', () => {
    const effect = chromaticAberration();
    const before = passSignature([effect], null);
    effect.offset = 0.01;
    expect(passSignature([effect], null)).toBe(before);
    effect.samples = 6;
    expect(passSignature([effect], null)).not.toBe(before);
  });
});

describe('planPasses', () => {
  it('merges pixel effects and starts a pass at each input effect', () => {
    const items = [
      bloom(),
      vignette(),
      holographicFoil(),
      chromaticAberration(),
      vignette(),
      rgbSplitGlitch(),
    ];
    const groups = planPasses(items, true);
    expect(
      groups.map((g) =>
        g.kind === 'effects' ? g.effects.map((e) => e.name) : 'foreign',
      ),
    ).toEqual([
      ['bloom', 'vignette', 'holographic-foil'],
      ['chromatic-aberration', 'vignette'],
      ['rgb-split-glitch'],
    ]);
  });

  it('skips disabled effects, isolates foreign passes and can turn merging off', () => {
    const foreign = { render() {} };
    const a = vignette();
    const b = vignette({ enabled: false });
    const c = holographicFoil();
    expect(planPasses([a, b, foreign, c], true).map((g) => g.kind)).toEqual([
      'effects',
      'foreign',
      'effects',
    ]);
    expect(planPasses([a, c], false)).toHaveLength(2);
  });
});
