import {
  AlwaysDepth,
  GreaterDepth,
  LessEqualDepth,
  MeshBasicMaterial,
  MeshNormalMaterial,
  MeshStandardMaterial,
  ShaderLib,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { describe, expect, it } from 'vitest';
import { compileMaterial } from '../../src/core/material-compile.js';
import {
  materialEffects,
  patchMaterial,
  unpatchMaterial,
} from '../../src/core/material.js';
import { defineMaterialEffect, float } from '../../src/effect/index.js';
import { dissolve } from '../../src/effects/dissolve/index.js';
import { fresnelGlow } from '../../src/effects/fresnel-glow/index.js';
import { hologram } from '../../src/effects/hologram/index.js';
import { thinFilm } from '../../src/effects/thin-film/index.js';
import { wireframe } from '../../src/effects/wireframe/index.js';
import { wobble } from '../../src/effects/wobble/index.js';
import { xRay } from '../../src/effects/x-ray/index.js';

/** Runs a material's onBeforeCompile on its ShaderLib source, as three.js would. */
function compile(material: MeshStandardMaterial | MeshBasicMaterial) {
  const lib =
    material.type === 'MeshBasicMaterial'
      ? ShaderLib.basic
      : ShaderLib.standard;
  const shader = {
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

describe('defineMaterialEffect', () => {
  it('requires $fragment and a well-formed $vertex', () => {
    expect(() =>
      defineMaterialEffect({
        name: 'broken',
        meta: {
          title: 'B',
          family: 'material',
          story: 'X0',
          description: 'B.',
        },
        params: { a: float({ default: 0, min: 0, max: 1, description: 'A.' }) },
        fragment: 'vec4 $main(vec4 c) { return c; }',
      }),
    ).toThrow(/\$fragment/);
    expect(() =>
      defineMaterialEffect({
        name: 'broken',
        meta: {
          title: 'B',
          family: 'material',
          story: 'X0',
          description: 'B.',
        },
        params: {},
        fragment: 'vec4 $fragment(vec4 c, XtSurface s) { return c; }',
        vertex: 'void move() {}',
      }),
    ).toThrow(/\$vertex/);
  });

  it('keeps a clock that stops with motion', () => {
    const effect = hologram();
    effect.tick(0.5);
    expect(effect.time).toBe(0.5);
    effect.setMotion(false);
    effect.tick(1);
    expect(effect.time).toBe(0.5);
    expect(effect.uniforms.time!.value).toBe(0.5);
  });
});

describe('compileMaterial', () => {
  it('renames each effect and calls them in order', () => {
    const a = fresnelGlow();
    const b = dissolve();
    const code = compileMaterial([a, b], { lit: true });
    expect(code.fragmentPars).toContain(
      'vec4 xtm0_fragment(vec4 color, XtSurface surface)',
    );
    expect(code.fragmentPars).toContain(
      'vec4 xtm1_fragment(vec4 color, XtSurface surface)',
    );
    expect(code.fragmentMain.indexOf('xtm0_fragment')).toBeLessThan(
      code.fragmentMain.indexOf('xtm1_fragment'),
    );
    expect(code.fragmentMain).toContain('xt_surface.viewNormal = normal;');
    expect(code.fragmentPars).not.toMatch(/\$\w/);
    expect(code.fragmentPars).not.toMatch(/#include <xtree/);
    expect(code.fragmentPars).not.toMatch(/#line/);
    expect(code.uniforms.xtm0_intensity).toBe(a.uniforms.intensity);
    expect(code.uniforms.xtm1_time).toBe(b.uniforms.time);
  });

  it('uses the vertex normal on unlit materials and only adds vertex calls when needed', () => {
    const unlit = compileMaterial([fresnelGlow()], { lit: false });
    expect(unlit.fragmentMain).toContain('normalize(xt_vViewNormal)');
    expect(unlit.vertexBeforeProject).not.toContain('_vertex(');
    const holo = compileMaterial([hologram()], { lit: true });
    expect(holo.vertexBeforeProject).toContain(
      'xtm0_vertex(transformed, xt_objectNormal);',
    );
    // Hologram only reads the normal, so lit shading keeps three.js's own.
    expect(holo.vertexAfterProject).not.toContain('vNormal');
  });

  it('writes a new normal from a vertex hook into lit shading, and reads barycentrics on request', () => {
    const lit = compileMaterial([wobble()], { lit: true });
    expect(lit.vertexAfterProject).toContain(
      'vNormal = normalize(normalMatrix * xt_normal);',
    );
    expect(
      compileMaterial([wobble()], { lit: false }).vertexAfterProject,
    ).not.toContain('vNormal');
    const lines = compileMaterial([wireframe()], { lit: true });
    expect(lines.vertexPars).toContain('in vec3 xtBarycentric;');
    expect(lines.fragmentMain).toContain(
      'xt_surface.barycentric = xt_vBarycentric;',
    );
    expect(
      compileMaterial([fresnelGlow()], { lit: true }).fragmentMain,
    ).toContain('xt_surface.barycentric = vec3(0.0);');
  });

  it('compiles structural parameters as defines', () => {
    const code = compileMaterial([thinFilm({ variation: 'height' })], {
      lit: true,
    });
    expect(code.fragmentPars).toContain('#define xtm0_variation 1');
    expect(code.key).not.toBe(compileMaterial([thinFilm()], { lit: true }).key);
  });
});

describe('patchMaterial', () => {
  it('applies settings computed from values, re-applies them on structural changes and restores them', () => {
    const material = new MeshStandardMaterial();
    const ray = xRay({ occlusion: 'hidden' });
    patchMaterial(material, ray);
    expect(material.depthFunc).toBe(GreaterDepth);
    expect(material.depthWrite).toBe(false);
    ray.occlusion = 'always';
    expect(material.depthFunc).toBe(AlwaysDepth);
    unpatchMaterial(material, ray);
    expect(material.depthFunc).toBe(LessEqualDepth);
    expect(material.depthWrite).toBe(true);
    ray.dispose();
  });

  it('splices code into the material shader and restores it when removed', () => {
    const material = new MeshStandardMaterial();
    const glow = fresnelGlow();
    const baseKey = material.customProgramCacheKey();
    patchMaterial(material, glow);
    expect(materialEffects(material)).toEqual([glow]);
    const shader = compile(material);
    expect(shader.fragmentShader).toContain(
      'xtm0_fragment(gl_FragColor, xt_surface)',
    );
    expect(
      shader.fragmentShader.indexOf('xtm0_fragment(gl_FragColor'),
    ).toBeGreaterThan(
      shader.fragmentShader.indexOf('#include <opaque_fragment>'),
    );
    expect(shader.vertexShader).toContain('xt_vViewPosition = mvPosition.xyz;');
    expect(material.customProgramCacheKey()).not.toBe(baseKey);
    // Uniform slots read through to the effect.
    glow.intensity = 3.5;
    expect((shader.uniforms.xtm0_intensity as { value: unknown }).value).toBe(
      3.5,
    );

    unpatchMaterial(material, glow);
    expect(materialEffects(material)).toEqual([]);
    expect(material.customProgramCacheKey()).toBe(baseKey);
    expect(compile(material).fragmentShader).not.toContain('xtm0_');
  });

  it('keeps uniform slots across re-patches so cached programs see the new effect', () => {
    const material = new MeshStandardMaterial();
    const first = fresnelGlow({ intensity: 1 });
    patchMaterial(material, first);
    const slot = compile(material).uniforms.xtm0_intensity as {
      value: unknown;
    };
    unpatchMaterial(material, first);
    const second = fresnelGlow({ intensity: 7 });
    patchMaterial(material, second);
    expect(slot.value).toBe(7);
  });

  it('marks materials for recompilation on structural changes only', () => {
    const material = new MeshBasicMaterial();
    const film = thinFilm();
    patchMaterial(material, film);
    const version = material.version;
    film.intensity = 0.2;
    expect(material.version).toBe(version);
    film.variation = 'uniform';
    expect(material.version).toBeGreaterThan(version);
    unpatchMaterial(material);
  });

  it('applies and restores blending settings', () => {
    const material = new MeshStandardMaterial();
    const holo = hologram();
    patchMaterial(material, holo);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    unpatchMaterial(material, holo);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });

  it('rejects unsupported materials and duplicate patches', () => {
    expect(() =>
      patchMaterial(new MeshNormalMaterial() as never, fresnelGlow()),
    ).toThrow(/not supported/);
    const material = new MeshStandardMaterial();
    const glow = fresnelGlow();
    patchMaterial(material, glow);
    expect(() => patchMaterial(material, glow)).toThrow(/already patched/);
  });
});
