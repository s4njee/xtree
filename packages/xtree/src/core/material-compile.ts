/**
 * Builds the GLSL that `patchMaterial` splices into three.js's built-in
 * materials. It has no three.js dependency so tools and tests can run it.
 */
import type { MaterialEffect } from '../effect/material.js';
import { resolveIncludes, type ChunkMap } from '../glsl/index.js';
import { declareParams, renameEffectSource } from './compile.js';

/** Prefix that replaces `$` for the material effect at `index` in a material. */
export const materialPrefix = (index: number): string => `xtm${index}_`;

/** The code `patchMaterial` splices into a built-in material's shaders. */
export interface MaterialInjection {
  /** Declarations after `#include <common>` in the vertex shader. */
  readonly vertexPars: string;
  /** Statements before `#include <project_vertex>` (may change `transformed`). */
  readonly vertexBeforeProject: string;
  /** Statements after `#include <project_vertex>` (fills the varyings). */
  readonly vertexAfterProject: string;
  /** Declarations after `#include <common>` in the fragment shader. */
  readonly fragmentPars: string;
  /** Statements after `#include <opaque_fragment>`. */
  readonly fragmentMain: string;
  /** Uniforms by GLSL name; the objects are shared with each effect. */
  readonly uniforms: Readonly<Record<string, { value: unknown }>>;
  /** Changes exactly when the injected code changes. */
  readonly key: string;
}

const varyings = [
  'varying vec3 xt_vViewPosition;',
  'varying vec3 xt_vViewNormal;',
  'varying vec3 xt_vWorldPosition;',
  'varying vec3 xt_vWorldNormal;',
  'varying vec3 xt_vObjectPosition;',
  'varying vec3 xt_vObjectNormal;',
  'varying vec2 xt_vUv;',
];

/** A vertex hook whose second parameter is `inout` writes a new normal. */
const writesNormal = (source: string) =>
  /\$vertex\s*\(\s*inout\s+vec3\s+\w+\s*,\s*inout\s+vec3/.test(source);

const surfaceStruct = [
  '/// What a material effect knows about the fragment it shades (view space unless named otherwise).',
  'struct XtSurface {',
  '  vec3 viewPosition;',
  '  vec3 viewDirection;',
  '  vec3 viewNormal;',
  '  vec3 worldPosition;',
  '  vec3 worldNormal;',
  '  vec3 objectPosition;',
  '  vec3 objectNormal;',
  '  vec2 uv;',
  '  /// Barycentric coordinates of the fragment in its triangle, for effects that ask for them; zero otherwise.',
  '  vec3 barycentric;',
  '};',
];

/** The key for `customProgramCacheKey`: changes exactly when the injected code changes. */
export function materialSignature(effects: readonly MaterialEffect[]): string {
  return JSON.stringify(
    effects.map((e) => [e.definition.name, e.structuralValues()]),
  );
}

/**
 * Compiles material effects, in order, for one material. `lit` says whether
 * the material computes a shading normal (`normal` in its fragment shader);
 * unlit materials such as MeshBasicMaterial use the interpolated vertex normal.
 */
export function compileMaterial(
  effects: readonly MaterialEffect[],
  options: { readonly lit: boolean },
): MaterialInjection {
  const uniforms: Record<string, { value: unknown }> = {};
  const maps: ChunkMap[] = [];
  const barycentric = effects.some(
    (e) => e.materialDefinition.barycentric === true,
  );
  const extra = barycentric ? ['varying vec3 xt_vBarycentric;'] : [];
  const vertexSources: string[] = [
    ...varyings,
    ...extra,
    ...(barycentric ? ['in vec3 xtBarycentric;'] : []),
  ];
  const fragmentSources: string[] = [...varyings, ...extra, ...surfaceStruct];
  let normalWritten = false;
  const vertexCalls: string[] = [];
  const fragmentCalls: string[] = [];
  effects.forEach((effect, index) => {
    const prefix = materialPrefix(index);
    const definition = effect.materialDefinition;
    maps.push(...(definition.chunks ?? []));
    const declarations = [
      `// ${definition.name}`,
      ...declareParams(effect, prefix, uniforms),
      `uniform float ${prefix}time;`,
    ];
    uniforms[`${prefix}time`] = effect.uniforms.time!;
    fragmentSources.push(
      ...declarations,
      renameEffectSource(definition.fragment, prefix),
    );
    fragmentCalls.push(
      `  gl_FragColor = ${prefix}fragment(gl_FragColor, xt_surface);`,
    );
    if (definition.vertex) {
      vertexSources.push(
        ...declarations,
        renameEffectSource(definition.vertex, prefix),
      );
      vertexCalls.push(`  ${prefix}vertex(transformed, xt_objectNormal);`);
      if (writesNormal(definition.vertex)) normalWritten = true;
    }
  });
  const resolve = (source: string, name: string) =>
    resolveIncludes(source, maps, { name, lineDirectives: false }).code;
  return {
    vertexPars: resolve(vertexSources.join('\n'), 'xtree-material-vertex'),
    vertexBeforeProject: [
      '  vec3 xt_objectNormal = normal;',
      ...vertexCalls,
    ].join('\n'),
    vertexAfterProject: [
      '  xt_vViewPosition = mvPosition.xyz;',
      '  vec4 xt_world = vec4(transformed, 1.0);',
      '  vec3 xt_normal = xt_objectNormal;',
      '  #ifdef USE_BATCHING',
      '    xt_world = batchingMatrix * xt_world;',
      '    xt_normal = mat3(batchingMatrix) * xt_normal;',
      '  #endif',
      '  #ifdef USE_INSTANCING',
      '    xt_world = instanceMatrix * xt_world;',
      '    xt_normal = mat3(instanceMatrix) * xt_normal;',
      '  #endif',
      '  xt_vWorldPosition = (modelMatrix * xt_world).xyz;',
      '  xt_vViewNormal = normalize(normalMatrix * xt_normal);',
      '  xt_vWorldNormal = normalize(mat3(modelMatrix) * xt_normal);',
      '  xt_vObjectPosition = transformed;',
      '  xt_vObjectNormal = xt_objectNormal;',
      '  xt_vUv = uv;',
      ...(barycentric ? ['  xt_vBarycentric = xtBarycentric;'] : []),
      // Lit materials shade with vNormal: follow a normal a vertex hook rewrote.
      ...(normalWritten && options.lit
        ? [
            '  #ifndef FLAT_SHADED',
            '    vNormal = normalize(normalMatrix * xt_normal);',
            '    #ifdef FLIP_SIDED',
            '      vNormal = -vNormal;',
            '    #endif',
            '  #endif',
          ]
        : []),
    ].join('\n'),
    fragmentPars: resolve(
      fragmentSources.join('\n'),
      'xtree-material-fragment',
    ),
    fragmentMain: [
      '{',
      '  XtSurface xt_surface;',
      '  xt_surface.viewPosition = xt_vViewPosition;',
      '  xt_surface.viewDirection = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-xt_vViewPosition);',
      options.lit
        ? '  xt_surface.viewNormal = normal;'
        : '  xt_surface.viewNormal = normalize(xt_vViewNormal) * (gl_FrontFacing ? 1.0 : -1.0);',
      '  xt_surface.worldPosition = xt_vWorldPosition;',
      '  xt_surface.worldNormal = normalize(xt_vWorldNormal);',
      '  xt_surface.objectPosition = xt_vObjectPosition;',
      '  xt_surface.objectNormal = normalize(xt_vObjectNormal);',
      '  xt_surface.uv = xt_vUv;',
      barycentric
        ? '  xt_surface.barycentric = xt_vBarycentric;'
        : '  xt_surface.barycentric = vec3(0.0);',
      ...fragmentCalls,
      '}',
    ].join('\n'),
    uniforms,
    key: `xtree:${options.lit ? 'lit' : 'unlit'}:${materialSignature(effects)}`,
  };
}
