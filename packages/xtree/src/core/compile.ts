/**
 * The merge compiler: turns an ordered list of effects into one GLSL ES 3.00
 * fragment shader. It has no three.js dependency so tools can run it in Node.
 */
import { resolveIncludes, type ChunkMap } from '../glsl/index.js';
import type { Effect } from '../effect/define.js';
import { fullscreenVertex } from '../effect/fullscreen-vertex.js';
import { maskKinds, type GeometryBuffer } from '../effect/mask.js';
import { glslTypes, samplerType, type Param } from '../effect/params.js';
import { blendModes } from '../shaders/blend/constants.js';
import {
  blendModesChunks,
  colorSpaceChunks,
  colorTonemapChunks,
  depthReconstructChunks,
  noiseBlueChunks,
} from '../shaders/maps.js';

export type ToneMapping =
  'none' | 'linear' | 'reinhard' | 'cineon' | 'aces' | 'agx' | 'neutral';

/** Conversion from linear HDR to the display, appended to the last pass. */
export interface OutputStage {
  readonly toneMapping: ToneMapping;
  readonly colorSpace: 'srgb' | 'linear';
  /** Adds ±0.5/255 interleaved gradient noise to hide banding. */
  readonly dither: boolean;
}

export interface CompiledPass {
  readonly vertex: string;
  readonly fragment: string;
  /** Source-string table for formatShaderError. */
  readonly files: readonly string[];
  /** Effect uniforms by GLSL name; the objects are shared with each effect. */
  readonly uniforms: Readonly<Record<string, { value: unknown }>>;
}

const toneMappers: Record<Exclude<ToneMapping, 'none'>, string> = {
  linear: 'xt_tonemapLinear',
  reinhard: 'xt_tonemapReinhard',
  cineon: 'xt_tonemapCineon',
  aces: 'xt_tonemapAces',
  agx: 'xt_tonemapAgx',
  neutral: 'xt_tonemapNeutral',
};

export { fullscreenVertex };

/** Prefix that replaces `$` for effect `index` in a pass. */
export const effectPrefix = (index: number): string => `e${index}_`;

/** Renames `$name` to the effect's prefix. */
export function renameEffectSource(source: string, prefix: string): string {
  return source.replace(
    /\$([A-Za-z_]\w*)/g,
    (_, name: string) => prefix + name,
  );
}

function literal(param: Param, value: number | boolean | number[]): string {
  const f = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));
  switch (param.kind) {
    case 'float':
      return f(value as number);
    case 'bool':
      return value ? 'true' : 'false';
    case 'color':
    case 'vec3':
      return `vec3(${(value as number[]).map(f).join(', ')})`;
    case 'vec2':
      return `vec2(${(value as number[]).map(f).join(', ')})`;
    default:
      return String(value);
  }
}

const identifier = (option: string) => option.replace(/\W+/g, '_');

/** A stable key for the compiled form of a pass: changes exactly when its shader must be rebuilt. */
export function passSignature(
  effects: readonly Effect[],
  output: OutputStage | null,
): string {
  return JSON.stringify([
    effects.map((e) => [
      e.id,
      e.definition.name,
      e.blend,
      e.structuralValues(),
      e.maskKind,
      e.requiredBuffers(),
    ]),
    output,
  ]);
}

/** Geometry buffers any effect in the list needs. */
export function passBuffers(
  effects: readonly Effect[],
): ReadonlySet<GeometryBuffer> {
  return new Set(effects.flatMap((e) => e.requiredBuffers()));
}

const depthHeader = [
  'uniform sampler2D xt_depthBuffer;',
  'uniform float xt_cameraNear;',
  'uniform float xt_cameraFar;',
  'uniform bool xt_cameraOrtho;',
  'uniform mat4 xt_projection;',
  'uniform mat4 xt_inverseProjection;',
  'uniform mat4 xt_cameraWorld;',
  '#include <xtree/depth/reconstruct>',
  '/// Depth-buffer value at uv: 0 at the near plane, 1 at the far plane and where nothing was drawn.',
  'float xt_depth(vec2 uv) {',
  '  return texture(xt_depthBuffer, uv).r;',
  '}',
  '/// Distance in front of the camera along its view axis, in scene units.',
  'float xt_viewDepth(vec2 uv) {',
  '  float d = xt_depth(uv);',
  '  return -(xt_cameraOrtho',
  '    ? xt_orthographicDepthToViewZ(d, xt_cameraNear, xt_cameraFar)',
  '    : xt_perspectiveDepthToViewZ(d, xt_cameraNear, xt_cameraFar));',
  '}',
  '/// View-space position at uv.',
  'vec3 xt_viewPosition(vec2 uv) {',
  '  return xt_viewPositionFromDepth(uv, xt_depth(uv), xt_inverseProjection);',
  '}',
  '/// World-space position at uv.',
  'vec3 xt_worldPosition(vec2 uv) {',
  '  return (xt_cameraWorld * vec4(xt_viewPosition(uv), 1.0)).xyz;',
  '}',
];

const normalHeader = [
  'uniform sampler2D xt_normalBuffer;',
  '/// View-space normal from the normal prepass; zero where nothing was drawn.',
  'vec3 xt_viewNormal(vec2 uv) {',
  '  vec4 n = texture(xt_normalBuffer, uv);',
  '  return n.a > 0.0 ? normalize(n.xyz * 2.0 - 1.0) : vec3(0.0);',
  '}',
];

/** GLSL for an effect's mask: uniforms and `<prefix>maskAt(uv)`. */
function maskSource(effect: Effect, prefix: string): string[] {
  const kind = effect.maskKind;
  const lines = [
    `#define ${prefix}has_mask ${kind ? 1 : 0}`,
    `#define ${prefix}maskKind ${kind ? maskKinds[kind] : 0}`,
  ];
  if (!kind) {
    lines.push(`float ${prefix}maskAt(vec2 uv) {`, '  return 1.0;', '}');
    return lines;
  }
  lines.push(`uniform bool ${prefix}xtMaskInvert;`);
  if (kind === 'depth') {
    lines.push(
      `uniform vec3 ${prefix}xtMaskRange;`,
      `float ${prefix}maskAt(vec2 uv) {`,
      `  vec3 range = ${prefix}xtMaskRange;`,
      '  float d = xt_viewDepth(uv);',
      '  float feather = max(range.z, 1e-4);',
      '  float m = smoothstep(range.x - feather, range.x, d) * (1.0 - smoothstep(range.y, range.y + feather, d));',
    );
  } else {
    lines.push(
      `uniform sampler2D ${prefix}xtMask;`,
      `uniform int ${prefix}xtMaskChannel;`,
      `float ${prefix}maskAt(vec2 uv) {`,
      `  float m = texture(${prefix}xtMask, uv)[${prefix}xtMaskChannel];`,
    );
  }
  lines.push(`  return ${prefix}xtMaskInvert ? 1.0 - m : m;`, '}');
  return lines;
}

/**
 * Compiles effects into one fragment shader. Each effect's `$` names become
 * `e<index>_` names, its uniforms are declared from its schema (structural
 * parameters become `#define`s), and `main` runs every `$main` in order,
 * mixing each result by the effect's opacity and blend mode.
 */
export function compilePass(
  effects: readonly Effect[],
  output: OutputStage | null,
  passId = 0,
): CompiledPass {
  const buffers = passBuffers(effects);
  const lines: string[] = [
    '#line 2 0',
    `// xtree-pass:${passId}`,
    'precision highp float;',
    'precision highp int;',
    'precision highp sampler2D;',
    'precision highp sampler3D;',
    'uniform sampler2D xt_inputBuffer;',
    'uniform vec2 xt_resolution;',
    'uniform vec2 xt_texel;',
    'uniform float xt_time;',
    'uniform float xt_delta;',
    'uniform int xt_frame;',
    'in vec2 vUv;',
    'out vec4 xt_fragColor;',
    ...(buffers.has('depth') ? depthHeader : []),
    ...(buffers.has('normal') ? normalHeader : []),
    '/// Reads the pass input.',
    'vec4 xt_sample(vec2 uv) {',
    '  return texture(xt_inputBuffer, uv);',
    '}',
  ];
  // Chunks the compiler itself may include; effects add their own.
  const maps: ChunkMap[] = [
    blendModesChunks,
    colorSpaceChunks,
    colorTonemapChunks,
    depthReconstructChunks,
    noiseBlueChunks,
  ];
  const effectChunks: Record<string, string> = {};
  const uniforms: Record<string, { value: unknown }> = {};
  const usesBlend = effects.some((e) => e.blend !== 'normal');
  if (usesBlend) lines.push('#include <xtree/blend/modes>');

  effects.forEach((effect, index) => {
    const prefix = effectPrefix(index);
    const { definition } = effect;
    const structural = effect.structuralValues();
    maps.push(...(definition.chunks ?? []));
    lines.push(`// ${definition.name}`);
    for (const [name, param] of Object.entries(definition.params) as [
      string,
      Param,
    ][]) {
      if (param.kind === 'select') {
        param.options.forEach((option, i) =>
          lines.push(`#define ${prefix}${name}_${identifier(option)} ${i}`),
        );
      }
      if (param.kind === 'texture') {
        lines.push(
          `uniform ${samplerType(param)} ${prefix}${name};`,
          `#define ${prefix}has_${name} ${structural[`has_${name}`] ? 1 : 0}`,
        );
        uniforms[prefix + name] = effect.uniforms[name]!;
      } else if (param.structural) {
        lines.push(
          `#define ${prefix}${name} ${literal(param, structural[name]!)}`,
        );
      } else {
        lines.push(`uniform ${glslTypes[param.kind]} ${prefix}${name};`);
        uniforms[prefix + name] = effect.uniforms[name]!;
      }
    }
    for (const texture of definition.textures ?? []) {
      lines.push(`uniform sampler2D ${prefix}${texture};`);
      uniforms[prefix + texture] = effect.uniforms[texture]!;
    }
    lines.push(`uniform float ${prefix}opacity;`);
    uniforms[`${prefix}opacity`] = effect.uniforms.opacity!;
    lines.push(...maskSource(effect, prefix));
    for (const name of [
      'xtMask',
      'xtMaskChannel',
      'xtMaskRange',
      'xtMaskInvert',
    ])
      uniforms[prefix + name] = effect.uniforms[name]!;
    const id = `effect/${index}/${definition.name}`;
    effectChunks[id] = renameEffectSource(definition.fragment, prefix);
    lines.push(`#include <${id}>`);
  });

  if (output) {
    lines.push('uniform float xt_exposure;', '#include <xtree/color/space>');
    if (output.toneMapping !== 'none')
      lines.push('#include <xtree/color/tonemap>');
    if (output.dither) lines.push('#include <xtree/noise/blue>');
  }

  lines.push(
    'void main() {',
    '  vec2 uv = vUv;',
    '  vec4 color = xt_sample(uv);',
    '  vec4 result;',
  );
  effects.forEach((effect, index) => {
    const prefix = effectPrefix(index);
    lines.push(`  result = ${prefix}main(color, uv);`);
    if (effect.blend !== 'normal') {
      lines.push(
        `  result.rgb = xt_blend(${blendModes[effect.blend]}, color.rgb, result.rgb);`,
      );
    }
    const masked =
      effect.maskKind && (effect.definition.masking ?? 'opacity') === 'opacity';
    lines.push(
      masked
        ? `  color = mix(color, result, ${prefix}opacity * ${prefix}maskAt(uv));`
        : `  color = mix(color, result, ${prefix}opacity);`,
    );
  });
  if (output) {
    if (output.toneMapping !== 'none') {
      lines.push(
        `  color.rgb = ${toneMappers[output.toneMapping]}(color.rgb, xt_exposure);`,
      );
    }
    if (output.colorSpace === 'srgb')
      lines.push('  color.rgb = xt_linearToSrgb(color.rgb);');
    if (output.dither)
      lines.push('  color.rgb += (xt_ign(gl_FragCoord.xy) - 0.5) / 255.0;');
  }
  lines.push('  xt_fragColor = color;', '}');

  const resolved = resolveIncludes(lines.join('\n'), [...maps, effectChunks], {
    name: 'xtree-pass',
  });
  return {
    vertex: fullscreenVertex,
    fragment: resolved.code,
    files: resolved.files,
    uniforms,
  };
}
