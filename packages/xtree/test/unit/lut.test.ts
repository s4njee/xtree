import { describe, expect, it } from 'vitest';
import {
  generateLut,
  lut,
  lutLooks,
  parseCubeLut,
} from '../../src/effects/lut/index.js';

const cube = `# A 2x2x2 identity LUT
TITLE "Identity"
LUT_3D_SIZE 2
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;

describe('parseCubeLut', () => {
  it('reads size, title and red-fastest RGBA data', () => {
    const parsed = parseCubeLut(cube);
    expect(parsed.title).toBe('Identity');
    expect(parsed.size).toBe(2);
    expect(Array.from(parsed.data.slice(0, 8))).toEqual([
      0, 0, 0, 1, 1, 0, 0, 1,
    ]);
    expect(Array.from(parsed.data.slice(-4))).toEqual([1, 1, 1, 1]);
  });

  it('folds DOMAIN_MIN and DOMAIN_MAX into [0, 1]', () => {
    const scaled = cube.replace(
      'LUT_3D_SIZE 2',
      'LUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 2 2 2',
    );
    expect(Array.from(parseCubeLut(scaled).data.slice(4, 8))).toEqual([
      0.5, 0, 0, 1,
    ]);
  });

  it('rejects malformed files', () => {
    expect(() => parseCubeLut('LUT_1D_SIZE 4')).toThrow(/1D LUTs/);
    expect(() => parseCubeLut('LUT_3D_SIZE 2\n0 0 0')).toThrow(
      /expected 8 entries, found 1/,
    );
    expect(() => parseCubeLut('0 0 0')).toThrow(/invalid LUT_3D_SIZE/);
  });
});

describe('generateLut', () => {
  it('matches the .cube layout', () => {
    expect(Array.from(generateLut(2, lutLooks.identity))).toEqual(
      Array.from(parseCubeLut(cube).data),
    );
  });

  it('keeps every built-in look in [0, 1]', () => {
    for (const [name, look] of Object.entries(lutLooks)) {
      const data = generateLut(9, look);
      expect(
        data.every((v) => v >= 0 && v <= 1),
        name,
      ).toBe(true);
    }
  });
});

describe('texture parameters', () => {
  it('accept sample names, textures and null, and track presence structurally', () => {
    const effect = lut();
    expect(effect.lut).toBe('tealOrange');
    expect(effect.structuralValues()).toEqual({ has_lut: true });
    const version = effect.structureVersion;
    effect.lut = 'warmFilm';
    expect(effect.structureVersion).toBe(version);
    effect.lut = null;
    expect(effect.structuralValues()).toEqual({ has_lut: false });
    expect(effect.structureVersion).toBe(version + 1);
    expect(() => (effect.lut = 'nope')).toThrow(/unknown sample "nope"/);
    expect(() => (effect.lut = {} as never)).toThrow(
      /expected a three.js texture/,
    );
    const fake = { isTexture: true as const };
    effect.lut = fake;
    expect(effect.uniforms.lut!.value).toBe(fake);
    expect(effect.toJSON()).toEqual({ effect: 'lut' });
  });

  it('resolve sample names once and dispose them with the effect', () => {
    const effect = lut();
    let created = 0;
    let disposed = 0;
    const create = () => {
      created++;
      return { isTexture: true as const, dispose: () => disposed++ };
    };
    effect.resolveSamples(create);
    effect.resolveSamples(create);
    expect(created).toBe(1);
    expect(effect.uniforms.lut!.value).not.toBeNull();
    effect.lut = 'coolNight';
    effect.resolveSamples(create);
    expect(created).toBe(2);
    effect.dispose();
    expect(disposed).toBe(2);
  });
});
