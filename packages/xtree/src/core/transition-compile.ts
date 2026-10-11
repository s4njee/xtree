/**
 * Compiles transitions for the xtree runtime (a GLSL ES 3.00 raw shader whose
 * parameters are uniforms) and for HoloCSS (a `ShaderMaterial` fragment whose
 * parameters are baked in, since its contract only carries `fromTexture`,
 * `toTexture`, `progress` and `accent`). No three.js dependency.
 */
import type { Param } from '../effect/params.js';
import type { Transition } from '../effect/transition.js';
import { resolveIncludes, type ChunkMap } from '../glsl/index.js';
import { colorSpaceChunks } from '../shaders/maps.js';
import {
  declareParams,
  identifier,
  literal,
  renameEffectSource,
} from './compile.js';
import { toUniformValue } from '../effect/params.js';

/** Prefix for the transition's `$` names. */
const prefix = 't0_';

const helpers = [
  '/// The outgoing image at uv (linear color).',
  'vec4 xt_from(vec2 uv) {',
  '  return texture(fromTexture, uv);',
  '}',
  '/// The incoming image at uv (linear color).',
  'vec4 xt_to(vec2 uv) {',
  '  return texture(toTexture, uv);',
  '}',
  '/// Size of the images in pixels.',
  'vec2 xt_size() {',
  '  return vec2(textureSize(fromTexture, 0));',
  '}',
  '#define xt_accent accent',
];

/** A transition's fragment shader, uniforms and source map. */
export interface CompiledTransition {
  readonly fragment: string;
  /** Source-string table for formatShaderError (xtree target only). */
  readonly files: readonly string[];
  readonly uniforms: Readonly<Record<string, { value: unknown }>>;
}

/** Defines for every parameter at its current value, for a shader with no parameter uniforms. */
function bakedParams(transition: Transition): string[] {
  const lines: string[] = [];
  for (const [name, param] of Object.entries(transition.definition.params) as [
    string,
    Param,
  ][]) {
    if (param.kind === 'select')
      param.options.forEach((option, i) =>
        lines.push(`#define ${prefix}${name}_${identifier(option)} ${i}`),
      );
    if (param.kind === 'texture') {
      if (transition.get(name as never) !== null)
        throw new TypeError(
          `toHoloEffect: ${transition.name}.${name} is a texture, which the HoloCSS contract can't carry; set it to null or use a built-in pattern`,
        );
      lines.push(
        `uniform sampler2D ${prefix}${name};`,
        `#define ${prefix}has_${name} 0`,
      );
      continue;
    }
    const value = toUniformValue(param, transition.get(name as never)) as
      number | boolean | number[];
    lines.push(`#define ${prefix}${name} ${literal(param, value)}`);
  }
  return lines;
}

/**
 * The xtree runtime's fragment shader: transition, then the output stage's
 * sRGB encoding when `srgb` is set.
 */
export function compileTransition(
  transition: Transition,
  options: { readonly srgb: boolean },
): CompiledTransition {
  const uniforms: Record<string, { value: unknown }> = {};
  const definition = transition.transitionDefinition;
  const source = [
    'precision highp float;',
    'precision highp int;',
    'precision highp sampler2D;',
    'precision highp sampler3D;',
    'uniform sampler2D fromTexture;',
    'uniform sampler2D toTexture;',
    'uniform float progress;',
    'uniform vec3 accent;',
    'in vec2 vUv;',
    'out vec4 xt_fragColor;',
    ...helpers,
    '#include <xtree/color/space>',
    ...declareParams(transition, prefix, uniforms),
    renameEffectSource(definition.fragment, prefix),
    'void main() {',
    `  vec4 color = ${prefix}transition(vUv, clamp(progress, 0.0, 1.0));`,
    ...(options.srgb ? ['  color.rgb = xt_linearToSrgb(color.rgb);'] : []),
    '  xt_fragColor = color;',
    '}',
  ].join('\n');
  const maps: ChunkMap[] = [colorSpaceChunks, ...(definition.chunks ?? [])];
  const resolved = resolveIncludes(source, maps, {
    name: `xtree-transition:${transition.name}`,
  });
  return { fragment: resolved.code, files: resolved.files, uniforms };
}

/** The fragment shader HoloCSS's `transition3d()` puts in a `ShaderMaterial`. */
export function compileHoloFragment(transition: Transition): string {
  const definition = transition.transitionDefinition;
  const source = [
    'uniform sampler2D fromTexture;',
    'uniform sampler2D toTexture;',
    'uniform float progress;',
    'uniform vec3 accent;',
    'varying vec2 vUv;',
    ...helpers,
    ...bakedParams(transition),
    renameEffectSource(definition.fragment, prefix),
    'void main() {',
    `  gl_FragColor = ${prefix}transition(vUv, clamp(progress, 0.0, 1.0));`,
    '  #include <colorspace_fragment>',
    '}',
  ].join('\n');
  return resolveIncludes(source, [...(definition.chunks ?? [])], {
    name: `holocss:${transition.name}`,
    lineDirectives: false,
  }).code;
}
