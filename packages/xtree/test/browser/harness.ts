import { readdirSync, readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import {
  formatShaderError,
  resolveIncludes,
  type ChunkMap,
} from '../../src/glsl/index.js';

const shaderRoot = new URL('../../src/shaders/', import.meta.url);

/** Every chunk, read from disk exactly as the library ships it (before minification). */
export const chunks: ChunkMap = Object.fromEntries(
  ['noise', 'color', 'blend', 'depth'].flatMap((family) =>
    readdirSync(new URL(`${family}/`, shaderRoot))
      .filter((file) => file.endsWith('.glsl'))
      .map((file) => [
        `xtree/${family}/${file.replace(/\.glsl$/, '')}`,
        readFileSync(new URL(`${family}/${file}`, shaderRoot), 'utf8'),
      ]),
  ),
);

export interface ShaderRun {
  /**
   * GLSL that includes chunks and defines `vec4 xt_test(vec4 input, int index)`.
   * `index` is the position of the input vec4; the uniform `xt_aux`
   * (sampler2D) holds the optional auxiliary texture.
   */
  readonly source: string;
  /** Flattened vec4 inputs. */
  readonly inputs: readonly number[];
  /** Optional RGBA32F texture bound to `xt_aux`. */
  readonly aux?: {
    readonly width: number;
    readonly height: number;
    readonly data: readonly number[];
  };
  /** Extra code placed before the resolved source, for example another library's chunk. */
  readonly prelude?: string;
  /** Extra chunks, resolved alongside the library's own. */
  readonly chunks?: ChunkMap;
}

export interface ShaderResult {
  readonly output: number[];
  readonly error?: string;
}

/** Compiles `source` (with xtree includes resolved) and evaluates it once per input vec4 on the GPU. */
export async function runShader(page: Page, run: ShaderRun): Promise<number[]> {
  const result = await compileAndRun(page, run);
  if (result.error) throw new Error(result.error);
  return result.output;
}

/** Like {@link runShader} but returns compile errors instead of throwing. */
export async function compileAndRun(
  page: Page,
  run: ShaderRun,
): Promise<ShaderResult> {
  const resolved = resolveIncludes(run.source, [chunks, run.chunks ?? {}], {
    name: 'test',
  });
  const result = await page.evaluate(gpuEvaluate, {
    code: resolved.code,
    prelude: run.prelude ?? '',
    inputs: [...run.inputs],
    aux: run.aux
      ? {
          width: run.aux.width,
          height: run.aux.height,
          data: [...run.aux.data],
        }
      : null,
  });
  if (result.error)
    return {
      output: [],
      error: formatShaderError(result.error, resolved.files),
    };
  return { output: result.output };
}

/** Runs in the page: a self-contained WebGL2 float evaluator. */
function gpuEvaluate(args: {
  code: string;
  prelude: string;
  inputs: number[];
  aux: { width: number; height: number; data: number[] } | null;
}): { output: number[]; error?: string } {
  const width = 256;
  const count = args.inputs.length / 4;
  const height = Math.max(1, Math.ceil(count / width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let creationError = '';
  canvas.addEventListener('webglcontextcreationerror', (event) => {
    creationError = (event as WebGLContextEvent).statusMessage;
  });
  const gl = canvas.getContext('webgl2');
  if (!gl)
    return {
      output: [],
      error: `WebGL2 is unavailable${creationError ? `: ${creationError}` : ''}`,
    };
  try {
    if (!gl.getExtension('EXT_color_buffer_float'))
      return { output: [], error: 'EXT_color_buffer_float is unavailable' };
    const compile = (type: number, text: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) ?? 'compile failed');
      return shader;
    };
    const vertex = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
    // The resolved code starts on source string 0, line 1, so errors in the test body map to "test".
    const fragment = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D xt_input;
uniform sampler2D xt_aux;
out vec4 xt_output;
${args.prelude}
vec4 xt_test(vec4 value, int index);
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  xt_output = xt_test(texelFetch(xt_input, c, 0), c.y * ${width} + c.x);
}
#line 1 0
${args.code}
`;
    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
    } catch (error) {
      return { output: [], error: (error as Error).message };
    }
    const texture = (
      unit: number,
      w: number,
      h: number,
      data: Float32Array,
    ) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        w,
        h,
        0,
        gl.RGBA,
        gl.FLOAT,
        data,
      );
      return t;
    };
    const input = new Float32Array(width * height * 4);
    input.set(args.inputs);
    texture(0, width, height, input);
    const aux = args.aux ?? { width: 1, height: 1, data: [0, 0, 0, 0] };
    texture(1, aux.width, aux.height, new Float32Array(aux.data));
    const target = texture(
      2,
      width,
      height,
      new Float32Array(width * height * 4),
    );
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      target,
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      return { output: [], error: 'RGBA32F framebuffer is incomplete' };
    }
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'xt_input'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'xt_aux'), 1);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixels = new Float32Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);
    return { output: Array.from(pixels.subarray(0, count * 4)) };
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** Groups a flat array into vec4 tuples. */
export function vec4s(
  values: readonly number[],
): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < values.length; i += 4)
    out.push([values[i]!, values[i + 1]!, values[i + 2]!, values[i + 3]!]);
  return out;
}

/** Deterministic pseudo-random numbers in [0, 1) for test inputs (mulberry32). */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
