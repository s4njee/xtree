import {
  ClampToEdgeWrapping,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  RawShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type { Texture, WebGLRenderer } from 'three';
import type {
  Effect,
  FrameInfo,
  SetupContext,
  ThreeKit,
} from '../effect/define.js';
import type { ParamSchema } from '../effect/params.js';
import { formatShaderError } from '../glsl/index.js';
import { compilePass, passSignature, type OutputStage } from './compile.js';
import { Fullscreen } from './fullscreen.js';

/** Source-string tables of live passes, for mapping compile errors (see EffectComposer). */
export const passFiles = new Map<number, readonly string[]>();

/** Formats a WebGL compile log for an xtree pass, or returns null for other shaders. */
export function describePassError(
  fragmentSource: string,
  log: string,
): string | null {
  const id = /xtree-pass:(\d+)/.exec(fragmentSource)?.[1];
  const files = id === undefined ? undefined : passFiles.get(Number(id));
  return files ? formatShaderError(log, files) : null;
}

let nextPassId = 1;

const threeKit: ThreeKit = {
  WebGLRenderTarget,
  RawShaderMaterial,
  Vector2,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  ClampToEdgeWrapping,
};

/**
 * Renders a list of effects as one merged full-screen pass. It implements
 * the three.js `Pass` interface, so it also works in the `EffectComposer`
 * from `three/examples/jsm/postprocessing` (put an `OutputPass` after it there).
 */
export class EffectPass {
  enabled = true;
  needsSwap = true;
  clear = false;
  renderToScreen = false;
  /** Seconds of effect time; advances by each render's delta while motion is allowed. */
  time = 0;
  frame = 0;
  /** Display conversion appended to this pass; the xtree composer sets it on the last pass. */
  output: OutputStage | null;
  /** Number of times this pass has (re)compiled its shader. */
  compiles = 0;
  readonly effects: readonly Effect[];
  readonly id = nextPassId++;
  readonly #fullscreen = new Fullscreen();
  readonly #globals = {
    xt_inputBuffer: { value: null as Texture | null },
    xt_resolution: { value: new Vector2(1, 1) },
    xt_texel: { value: new Vector2(1, 1) },
    xt_time: { value: 0 },
    xt_delta: { value: 0 },
    xt_frame: { value: 0 },
    xt_exposure: { value: 1 },
  };
  #material: RawShaderMaterial | null = null;
  #signature = '';
  #width = 1;
  #height = 1;
  #motion = true;

  constructor(
    effects: readonly Effect[],
    options: { output?: OutputStage | null } = {},
  ) {
    this.effects = [...effects];
    this.output = options.output ?? null;
  }

  /** Whether effects animate. Off freezes time and settles effects that declare still values. */
  get motion(): boolean {
    return this.#motion;
  }
  set motion(allowed: boolean) {
    this.#motion = allowed;
    for (const effect of this.effects) effect.setMotion(allowed);
  }

  /** Tone-mapping exposure used by the output stage. */
  set exposure(value: number) {
    this.#globals.xt_exposure.value = value;
  }

  setSize(width: number, height: number): void {
    this.#width = Math.max(1, Math.floor(width));
    this.#height = Math.max(1, Math.floor(height));
    this.#globals.xt_resolution.value.set(this.#width, this.#height);
    this.#globals.xt_texel.value.set(1 / this.#width, 1 / this.#height);
    for (const effect of this.effects)
      effect.resources?.setSize(this.#width, this.#height);
  }

  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget | null,
    readBuffer: WebGLRenderTarget,
    deltaTime = 0,
  ): void {
    if (readBuffer.width !== this.#width || readBuffer.height !== this.#height)
      this.setSize(readBuffer.width, readBuffer.height);
    const delta = this.#motion ? deltaTime : 0;
    this.time += delta;
    this.frame++;
    const material = this.#ensureMaterial();
    const frame: FrameInfo = {
      time: this.time,
      delta,
      frame: this.frame,
      width: this.#width,
      height: this.#height,
    };
    for (const effect of this.effects)
      this.#prepare(effect, renderer, readBuffer.texture, frame);
    const globals = this.#globals;
    globals.xt_inputBuffer.value = readBuffer.texture;
    globals.xt_time.value = this.time;
    globals.xt_delta.value = delta;
    globals.xt_frame.value = this.frame;
    this.#fullscreen.draw(
      renderer,
      material,
      this.renderToScreen ? null : writeBuffer,
    );
  }

  dispose(): void {
    this.#material?.dispose();
    this.#material = null;
    passFiles.delete(this.id);
    this.#fullscreen.dispose();
  }

  #ensureMaterial(): RawShaderMaterial {
    const signature = passSignature(this.effects, this.output);
    if (this.#material && signature === this.#signature) return this.#material;
    this.#material?.dispose();
    const compiled = compilePass(this.effects, this.output, this.id);
    passFiles.set(this.id, compiled.files);
    this.#material = new RawShaderMaterial({
      name: `xtree:${this.effects.map((e) => e.name).join('+') || 'output'}`,
      glslVersion: GLSL3,
      vertexShader: compiled.vertex,
      fragmentShader: compiled.fragment,
      uniforms: { ...this.#globals, ...compiled.uniforms },
      depthTest: false,
      depthWrite: false,
    });
    this.#signature = signature;
    this.compiles++;
    return this.#material;
  }

  #prepare(
    effect: Effect,
    renderer: WebGLRenderer,
    input: Texture,
    frame: FrameInfo,
  ): void {
    const { setup } = effect.definition;
    if (!setup) return;
    if (!effect.resources) {
      // Owned by the effect: it keeps its resources if a later plan moves it to another pass.
      const fullscreen = new Fullscreen();
      effect.onDispose(() => fullscreen.dispose());
      const context: SetupContext<ParamSchema> = {
        three: threeKit,
        effect: effect as SetupContext<ParamSchema>['effect'],
        draw: (r, material, target) => fullscreen.draw(r, material, target),
      };
      effect.resources = setup(context);
      effect.resources.setSize(this.#width, this.#height);
    }
    effect.resources.prepare(renderer, input, frame);
  }
}
