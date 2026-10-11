import { describe, expect, it } from 'vitest';
import { defineEffect, float, int } from '../../src/effect/index.js';

const costly = defineEffect({
  name: 'costly',
  meta: {
    title: 'Costly',
    family: 'glow',
    story: 'X0.0',
    description: 'Test effect.',
  },
  params: {
    samples: int({ default: 32, min: 4, max: 64, description: '' }),
    radius: float({ default: 1, min: 0, max: 4, description: '' }),
  },
  quality: { low: { samples: 8 }, medium: { samples: 16 } },
  fragment: 'vec4 $main(vec4 c, vec2 uv) { return c * $radius; }',
});

describe('quality tiers (X17.3)', () => {
  it('applies tiers and restores the effect’s own values at high', () => {
    const effect = costly({ samples: 40 });
    expect(effect.quality).toBe('auto');
    effect.quality = 'low';
    expect(effect.samples).toBe(8);
    effect.quality = 'medium';
    expect(effect.samples).toBe(16);
    effect.quality = 'high';
    expect(effect.samples).toBe(40);
    expect(() => {
      effect.quality = 'ultra' as never;
    }).toThrow(TypeError);
  });

  it('follows an adaptive composer only while quality is auto', () => {
    const effect = costly();
    effect.adaptQuality('low');
    expect(effect.samples).toBe(8);
    effect.adaptQuality('high');
    expect(effect.samples).toBe(32);
    effect.quality = 'medium';
    effect.adaptQuality('low');
    expect(effect.samples).toBe(16);
  });

  it('leaves effects without tiers alone', () => {
    const plain = defineEffect({
      name: 'plain',
      meta: costly.definition.meta,
      params: {
        radius: float({ default: 1, min: 0, max: 4, description: '' }),
      },
      fragment: 'vec4 $main(vec4 c, vec2 uv) { return c * $radius; }',
    })();
    plain.quality = 'low';
    expect(plain.radius).toBe(1);
  });
});
