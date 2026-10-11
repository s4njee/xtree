import { describe, expect, it } from 'vitest';
import { compilePass, passSignature } from '../../src/core/compile.js';
import { bufferView } from '../../src/effects/buffer-view/index.js';
import { depthFog } from '../../src/effects/depth-fog/index.js';
import { outline } from '../../src/effects/outline/index.js';
import { vignette } from '../../src/effects/vignette/index.js';

const texture = { isTexture: true } as const;
const object = { isObject3D: true } as never;

describe('masks', () => {
  it('accepts each kind and rejects malformed masks with the effect name', () => {
    const effect = vignette();
    effect.mask = { texture, channel: 'a', invert: true };
    expect(effect.maskKind).toBe('texture');
    expect(effect.uniforms.xtMaskChannel!.value).toBe(3);
    expect(effect.uniforms.xtMaskInvert!.value).toBe(true);
    effect.mask = { depth: [1, 5], feather: 0.5 };
    expect(effect.uniforms.xtMaskRange!.value).toEqual([1, 5, 0.5]);
    effect.mask = { selection: [object] };
    effect.mask = { selection: { layer: 3 }, xray: true };
    expect(effect.maskKind).toBe('selection');
    effect.mask = null;
    expect(effect.maskKind).toBe(null);

    expect(() => (effect.mask = { depth: [5, 1] })).toThrow(RangeError);
    expect(() => (effect.mask = { depth: [1, 5], feather: -1 })).toThrow(
      /vignette\.mask/,
    );
    expect(() => (effect.mask = { texture: {} as never })).toThrow(TypeError);
    expect(() => (effect.mask = { texture, channel: 'x' as never })).toThrow(
      /channel/,
    );
    expect(() => (effect.mask = { selection: { layer: 40 } })).toThrow(/layer/);
    expect(() => (effect.mask = { texture, depth: [0, 1] } as never)).toThrow(
      /exactly one/,
    );
  });

  it('changing the kind recompiles; changing values does not', () => {
    const effect = vignette({ mask: { depth: [1, 5] } });
    const version = effect.structureVersion;
    effect.mask = { depth: [2, 9], feather: 1 };
    expect(effect.structureVersion).toBe(version);
    effect.mask = { texture };
    expect(effect.structureVersion).toBe(version + 1);
    const before = passSignature([effect], null);
    effect.mask = null;
    expect(passSignature([effect], null)).not.toBe(before);
  });

  it('serializes depth masks only', () => {
    expect(vignette({ mask: { depth: [0, 4] } }).toJSON()).toEqual({
      effect: 'vignette',
      mask: { depth: [0, 4] },
    });
    expect(vignette({ mask: { texture } }).toJSON()).toEqual({
      effect: 'vignette',
    });
  });
});

describe('geometry buffers', () => {
  it('come from the definition, structural parameters and depth masks', () => {
    expect(vignette().requiredBuffers()).toEqual([]);
    expect(vignette({ mask: { depth: [0, 1] } }).requiredBuffers()).toEqual([
      'depth',
    ]);
    expect(depthFog().requiredBuffers()).toEqual(['depth']);
    expect(outline().requiredBuffers()).toEqual(['depth', 'normal']);
    expect(outline({ edges: 'depth' }).requiredBuffers()).toEqual(['depth']);
    expect(outline({ mask: { texture } }).requiredBuffers()).toEqual([]);
    expect(bufferView({ buffer: 'normal' }).requiredBuffers()).toEqual([
      'normal',
    ]);
  });

  it('compile into the header only when a pass needs them', () => {
    const plain = compilePass([vignette()], null).fragment;
    expect(plain).not.toContain('xt_depthBuffer');
    expect(plain).not.toContain('xt_normalBuffer');
    const deep = compilePass([vignette(), outline()], null).fragment;
    expect(deep).toContain('uniform sampler2D xt_depthBuffer;');
    expect(deep).toContain('float xt_viewDepth(vec2 uv)');
    expect(deep).toContain('vec3 xt_viewNormal(vec2 uv)');
    expect(deep).toContain('xt_perspectiveDepthToViewZ');
  });

  it('scale opacity by the mask unless the effect handles it', () => {
    const masked = compilePass(
      [vignette({ mask: { texture } }), outline({ mask: { texture } })],
      null,
    );
    expect(masked.fragment).toContain(
      'color = mix(color, result, e0_opacity * e0_maskAt(uv));',
    );
    expect(masked.fragment).toContain(
      'color = mix(color, result, e1_opacity);',
    );
    expect(masked.fragment).toContain('#define e1_has_mask 1');
    expect(masked.uniforms.e0_xtMask).toBeDefined();
    const unmasked = compilePass([vignette()], null).fragment;
    expect(unmasked).toContain('#define e0_has_mask 0');
    expect(unmasked).toContain('color = mix(color, result, e0_opacity);');
  });
});
