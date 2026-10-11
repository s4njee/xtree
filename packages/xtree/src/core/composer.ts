import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  HalfFloatType,
  LinearToneMapping,
  NeutralToneMapping,
  NoToneMapping,
  ReinhardToneMapping,
  SRGBColorSpace,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type {
  Camera,
  Object3D,
  TextureDataType,
  ToneMapping as ThreeToneMapping,
  WebGLRenderer,
} from 'three';
import type { Effect } from '../effect/define.js';
import type { OutputStage, ToneMapping } from './compile.js';
import { describePassError, EffectPass } from './pass.js';
import {
  isEffect,
  planPasses,
  type ForeignPass,
  type StackItem,
} from './plan.js';

export interface EffectComposerOptions {
  /** Texture type of the intermediate buffers. Defaults to half float, which keeps HDR values. */
  readonly frameBufferType?: TextureDataType;
  /** MSAA samples for the scene render. Defaults to 0. */
  readonly multisampling?: number;
  /** Caps the device pixel ratio the effects render at. Defaults to 2. */
  readonly maxDpr?: number;
  /** Caps the effect buffers' pixel count. Defaults to 4 million. */
  readonly maxPixels?: number;
  /** Merge compatible effects into one pass. Defaults to true; turn off to debug. */
  readonly merge?: boolean;
  /** Dither the final output to hide banding. Defaults to false. */
  readonly dithering?: boolean;
  /** Whether effects animate. Defaults to true. */
  readonly motion?: boolean;
}

export interface ComposerStats {
  /** Shader (re)compilations across all passes. */
  compiles: number;
  /** Buffer allocations, which happen on the first render and on resize. */
  allocations: number;
}

const toneMappings = new Map<ThreeToneMapping, ToneMapping>([
  [NoToneMapping, 'none'],
  [LinearToneMapping, 'linear'],
  [ReinhardToneMapping, 'reinhard'],
  [CineonToneMapping, 'cineon'],
  [ACESFilmicToneMapping, 'aces'],
  [AgXToneMapping, 'agx'],
  [NeutralToneMapping, 'neutral'],
]);

type PlannedPass =
  | { readonly kind: 'effects'; readonly pass: EffectPass }
  | { readonly kind: 'foreign'; readonly pass: ForeignPass };

/**
 * Renders a scene through a stack of effects. Consecutive effects are merged
 * into as few full-screen passes as possible; the last pass converts the
 * linear HDR result to the display using the renderer's tone mapping,
 * exposure and output color space, applied exactly once.
 *
 * ```ts
 * const composer = new EffectComposer(renderer);
 * composer.setScene(scene, camera);
 * composer.add(bloom(), vignette({ darkness: 0.6 }));
 * renderer.setAnimationLoop(() => composer.render());
 * ```
 */
export class EffectComposer {
  readonly renderer: WebGLRenderer;
  scene: Object3D | null = null;
  camera: Camera | null = null;
  readonly stats: ComposerStats = { compiles: 0, allocations: 0 };
  readonly #options: Required<
    Omit<EffectComposerOptions, 'merge' | 'motion' | 'dithering'>
  >;
  #items: StackItem[] = [];
  #merge: boolean;
  #motion: boolean;
  #dithering: boolean;
  #plan: PlannedPass[] = [];
  #planKey = '';
  #outputPass: EffectPass | null = null;
  #sceneTarget: WebGLRenderTarget | null = null;
  #targets: [WebGLRenderTarget, WebGLRenderTarget] | null = null;
  #width = 0;
  #height = 0;
  #lastTime: number | undefined;
  #time = 0;
  /** The time effects see while motion is off. */
  #frozenTime = 0;
  #lost = false;
  #disposed = false;
  readonly #size = new Vector2();
  readonly #onLost = () => {
    this.#lost = true;
  };
  readonly #onRestored = () => {
    this.#lost = false;
    this.#width = this.#height = 0;
  };
  #restoreShaderErrors: (() => void) | null = null;

  constructor(renderer: WebGLRenderer, options: EffectComposerOptions = {}) {
    this.renderer = renderer;
    this.#options = {
      frameBufferType: options.frameBufferType ?? HalfFloatType,
      multisampling: options.multisampling ?? 0,
      maxDpr: options.maxDpr ?? 2,
      maxPixels: options.maxPixels ?? 4_000_000,
    };
    this.#merge = options.merge ?? true;
    this.#motion = options.motion ?? true;
    this.#dithering = options.dithering ?? false;
    const canvas = renderer.domElement as HTMLCanvasElement | undefined;
    canvas?.addEventListener?.('webglcontextlost', this.#onLost);
    canvas?.addEventListener?.('webglcontextrestored', this.#onRestored);
    if (renderer.debug && renderer.debug.onShaderError === null) {
      renderer.debug.onShaderError = (
        gl,
        program,
        vertexShader,
        fragmentShader,
      ) => {
        const fragmentLog = gl.getShaderInfoLog(fragmentShader) ?? '';
        const described = describePassError(
          gl.getShaderSource(fragmentShader) ?? '',
          fragmentLog,
        );
        console.error(
          described
            ? `xtree: an effect pass failed to compile\n${described}`
            : `THREE.WebGLProgram: shader error\n${gl.getProgramInfoLog(program) ?? ''}\n${gl.getShaderInfoLog(vertexShader) ?? ''}\n${fragmentLog}`,
        );
      };
      this.#restoreShaderErrors = () => {
        renderer.debug.onShaderError = null;
      };
    }
  }

  setScene(scene: Object3D, camera: Camera): this {
    this.scene = scene;
    this.camera = camera;
    return this;
  }

  /** The stack, in order. */
  get items(): readonly StackItem[] {
    return this.#items;
  }

  /** Effects in the stack. */
  get effects(): readonly Effect[] {
    return this.#items.filter(isEffect);
  }

  /** Appends effects or three.js passes. An effect instance may appear in only one composer. */
  add(...items: StackItem[]): this {
    return this.setItems([...this.#items, ...items]);
  }

  /** Removes items from the stack without disposing them. */
  remove(...items: StackItem[]): this {
    return this.setItems(this.#items.filter((item) => !items.includes(item)));
  }

  /** Replaces the stack. Items no longer in it are not disposed. */
  setItems(items: readonly StackItem[]): this {
    if (new Set(items).size !== items.length)
      throw new TypeError('EffectComposer: an item appears twice in the stack');
    this.#items = [...items];
    for (const effect of this.effects) effect.setMotion(this.#motion);
    return this;
  }

  /** Whether compatible effects share passes. */
  get merge(): boolean {
    return this.#merge;
  }
  set merge(value: boolean) {
    this.#merge = value;
  }

  /**
   * Whether effects animate. Off holds the time effects see at the moment
   * motion stopped (even if `time` is set later) and settles effects that
   * declare still values, so nothing moves until motion is allowed again.
   */
  get motion(): boolean {
    return this.#motion;
  }
  set motion(allowed: boolean) {
    if (!allowed && this.#motion) this.#frozenTime = this.#time;
    this.#motion = allowed;
    for (const effect of this.effects) effect.setMotion(allowed);
  }

  /** Dithers the final output. */
  get dithering(): boolean {
    return this.#dithering;
  }
  set dithering(value: boolean) {
    this.#dithering = value;
  }

  /** Effect time in seconds. Set it to scrub or to render a fixed frame; while motion is off, effects keep the frozen time. */
  get time(): number {
    return this.#time;
  }
  set time(seconds: number) {
    this.#time = seconds;
  }

  /** The passes the last render used, in order (for inspection and tests). */
  get passes(): readonly (EffectPass | ForeignPass)[] {
    return this.#plan.map((p) => p.pass);
  }

  /** The size of the effect buffers in pixels, after the DPR and pixel caps. */
  get bufferSize(): { readonly width: number; readonly height: number } {
    return { width: this.#width, height: this.#height };
  }

  /**
   * Renders one frame to the canvas, or into `target` (for example to use the
   * result as a texture). `delta` is in seconds; by default it is measured
   * from the previous call.
   */
  render(delta?: number, target: WebGLRenderTarget | null = null): void {
    if (this.#disposed) throw new Error('EffectComposer: render after dispose');
    if (this.#lost) return;
    if (!this.scene || !this.camera)
      throw new Error(
        'EffectComposer: call setScene(scene, camera) before render',
      );
    const now = performance.now();
    const seconds =
      delta ??
      (this.#lastTime === undefined ? 0 : (now - this.#lastTime) / 1000);
    this.#lastTime = now;
    if (this.#motion) this.#time += seconds;

    const renderer = this.renderer;
    this.#updateSize();
    this.#updatePlan();
    const plan = this.#plan;
    const output = this.#outputStage();
    const steps: PlannedPass[] =
      plan.length && plan.at(-1)!.kind === 'effects'
        ? plan
        : [...plan, { kind: 'effects', pass: this.#ensureOutputPass() }];

    const previousTarget = renderer.getRenderTarget();
    const sceneTarget = this.#sceneTarget!;
    renderer.setRenderTarget(sceneTarget);
    renderer.render(this.scene, this.camera);

    let read = sceneTarget;
    let [write, spare] = this.#targets!;
    steps.forEach((step, index) => {
      const last = index === steps.length - 1;
      if (step.kind === 'effects') {
        const pass = step.pass;
        pass.output = last ? output : null;
        pass.renderToScreen = last && target === null;
        pass.exposure = renderer.toneMappingExposure;
        pass.motion = this.#motion;
        // The pass adds `seconds` while motion is on, landing on the composer's time.
        pass.time = this.#motion ? this.#time - seconds : this.#frozenTime;
        pass.render(renderer, last ? target : write, read, seconds);
      } else {
        step.pass.renderToScreen = false;
        step.pass.render(renderer, write, read, seconds, false);
        if (step.pass.needsSwap === false) return;
      }
      if (!last) {
        read = write;
        [write, spare] = [spare, write];
      }
    });
    renderer.setRenderTarget(previousTarget);
    this.stats.compiles = this.#countCompiles();
  }

  /** Disposes passes, buffers and every effect in the stack. Safe to call more than once. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const step of this.#plan) step.pass.dispose?.();
    this.#outputPass?.dispose();
    for (const item of this.#items) item.dispose?.();
    this.#sceneTarget?.dispose();
    this.#targets?.forEach((t) => t.dispose());
    this.#plan = [];
    this.#items = [];
    const canvas = this.renderer.domElement as HTMLCanvasElement | undefined;
    canvas?.removeEventListener?.('webglcontextlost', this.#onLost);
    canvas?.removeEventListener?.('webglcontextrestored', this.#onRestored);
    this.#restoreShaderErrors?.();
  }

  #outputStage(): OutputStage {
    const toneMapping = toneMappings.get(this.renderer.toneMapping) ?? 'none';
    return {
      toneMapping,
      colorSpace:
        this.renderer.outputColorSpace === SRGBColorSpace ? 'srgb' : 'linear',
      dither: this.#dithering,
    };
  }

  #updateSize(): void {
    const { maxDpr, maxPixels, frameBufferType, multisampling } = this.#options;
    const size = this.renderer.getDrawingBufferSize(this.#size);
    const dprScale = Math.min(1, maxDpr / this.renderer.getPixelRatio());
    const pixelScale = Math.min(
      1,
      Math.sqrt(maxPixels / Math.max(1, size.x * size.y)),
    );
    const scale = Math.min(dprScale, pixelScale);
    const width = Math.max(1, Math.round(size.x * scale));
    const height = Math.max(1, Math.round(size.y * scale));
    if (width === this.#width && height === this.#height && this.#sceneTarget)
      return;
    this.#width = width;
    this.#height = height;
    if (!this.#sceneTarget) {
      this.#sceneTarget = new WebGLRenderTarget(width, height, {
        type: frameBufferType,
        samples: multisampling,
      });
      const options = { type: frameBufferType, depthBuffer: false };
      this.#targets = [
        new WebGLRenderTarget(width, height, options),
        new WebGLRenderTarget(width, height, options),
      ];
    } else {
      this.#sceneTarget.setSize(width, height);
      this.#targets!.forEach((t) => t.setSize(width, height));
    }
    for (const step of this.#plan) step.pass.setSize?.(width, height);
    this.#outputPass?.setSize(width, height);
    this.stats.allocations++;
  }

  #updatePlan(): void {
    const key = JSON.stringify([
      this.#merge,
      this.#items.map((item) =>
        isEffect(item)
          ? [item.id, item.enabled, item.definition.sampling ?? 'pixel']
          : foreignId(item),
      ),
    ]);
    if (key === this.#planKey) return;
    this.#planKey = key;
    const previous = new Map(
      this.#plan
        .filter((p) => p.kind === 'effects')
        .map((p) => [
          groupKey((p.pass as EffectPass).effects),
          p.pass as EffectPass,
        ]),
    );
    const next: PlannedPass[] = planPasses(this.#items, this.#merge).map(
      (group) => {
        if (group.kind === 'foreign')
          return { kind: 'foreign', pass: group.pass };
        const key = groupKey(group.effects);
        const reused = previous.get(key);
        if (reused) {
          previous.delete(key);
          return { kind: 'effects', pass: reused };
        }
        const pass = new EffectPass(group.effects);
        pass.setSize(this.#width, this.#height);
        return { kind: 'effects', pass };
      },
    );
    for (const unused of previous.values()) {
      this.#retiredCompiles += unused.compiles;
      unused.dispose();
    }
    for (const step of next)
      if (step.kind === 'foreign')
        step.pass.setSize?.(this.#width, this.#height);
    this.#plan = next;
  }

  #ensureOutputPass(): EffectPass {
    if (!this.#outputPass) {
      this.#outputPass = new EffectPass([]);
      this.#outputPass.setSize(this.#width, this.#height);
    }
    return this.#outputPass;
  }

  #countCompiles(): number {
    let total = this.#outputPass?.compiles ?? 0;
    for (const step of this.#plan)
      if (step.kind === 'effects') total += step.pass.compiles;
    return total + this.#retiredCompiles;
  }

  #retiredCompiles = 0;
}

const groupKey = (effects: readonly Effect[]) =>
  effects.map((e) => e.id).join(',');

const foreignIds = new WeakMap<ForeignPass, string>();
let nextForeignId = 1;
function foreignId(pass: ForeignPass): string {
  let id = foreignIds.get(pass);
  if (!id) foreignIds.set(pass, (id = `pass${nextForeignId++}`));
  return id;
}
