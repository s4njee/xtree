import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  DepthTexture,
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
import type { EffectMask, SelectionMask } from '../effect/mask.js';
import { NormalPrepass, SelectionPrepass } from './buffers.js';
import { GpuTimer } from './timing.js';
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
  /** Measure GPU time per pass (see `timings`) where the GPU supports timer queries. */
  readonly timing?: boolean;
  /** Whether effects animate. Defaults to true. */
  readonly motion?: boolean;
  /**
   * Start advancing time on the first render. Defaults to false: animated
   * effects hold still until `play()` (WCAG 2.2.2: no motion the user didn't
   * start or can't pause).
   */
  readonly autoplay?: boolean;
}

export interface ComposerStats {
  /** Shader (re)compilations across all passes. */
  compiles: number;
  /** Buffer allocations, which happen on the first render and on resize. */
  allocations: number;
  /** Extra scene renders in the last frame: the normal prepass and one per distinct selection mask. */
  prepasses: number;
  /** Whether the last frame's scene render kept a depth texture. */
  depth: boolean;
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
  readonly stats: ComposerStats = {
    compiles: 0,
    allocations: 0,
    prepasses: 0,
    depth: false,
  };
  readonly #options: Required<
    Omit<
      EffectComposerOptions,
      'merge' | 'motion' | 'dithering' | 'autoplay' | 'timing'
    >
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
  #normal: NormalPrepass | null = null;
  readonly #selections = new Map<EffectMask, SelectionPrepass>();
  #width = 0;
  #height = 0;
  #lastTime: number | undefined;
  #time = 0;
  /** The time effects see while motion is off. */
  #frozenTime = 0;
  #lost = false;
  #playing = false;
  #timing = false;
  #timer: GpuTimer | null = null;
  #unsubscribe: (() => void) | null = null;
  /**
   * Values every effect can read as uniforms: `xt_progress`, `xt_pointer`
   * (UV, origin bottom left), `xt_pointerVelocity` (UV per second),
   * `xt_scroll` and `xt_audio` (bass, mid, treble, level). Set them directly
   * or with `drive()`, `trackPointer()`, `trackScroll()` and `trackAudio()`.
   */
  readonly inputs: {
    progress: number;
    pointer: [number, number];
    pointerVelocity: [number, number];
    scroll: number;
    audio: [number, number, number, number];
  } = {
    progress: 0,
    pointer: [0.5, 0.5],
    pointerVelocity: [0, 0],
    scroll: 0,
    audio: [0, 0, 0, 0],
  };
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
    this.#playing = options.autoplay ?? false;
    this.#dithering = options.dithering ?? false;
    this.#timing = options.timing ?? false;
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

  /** Whether time advances on render (it also needs motion to be allowed). */
  get playing(): boolean {
    return this.#playing;
  }

  /** Starts advancing time. */
  play(): this {
    this.#playing = true;
    return this;
  }

  /** Stops advancing time; effects hold their current frame. */
  pause(): this {
    this.#playing = false;
    return this;
  }

  /** The `xt_progress` value, 0–1. */
  get progress(): number {
    return this.inputs.progress;
  }
  set progress(value: number) {
    this.inputs.progress = Math.min(
      1,
      Math.max(0, Number.isFinite(value) ? value : 0),
    );
  }

  /**
   * Follows an external progress source, such as HoloCSS's
   * `scrollProgress()` or anything with `subscribe(callback)`. Replaces any
   * previous source; returns a function that stops following it.
   */
  drive(source: {
    readonly value?: number;
    subscribe(callback: (progress: number) => void): () => void;
  }): () => void {
    this.#unsubscribe?.();
    this.#timer?.dispose();
    if (source.value !== undefined) this.progress = source.value;
    const stop = source.subscribe((value) => {
      this.progress = value;
    });
    this.#unsubscribe = () => {
      stop();
      this.#unsubscribe = null;
    };
    return this.#unsubscribe;
  }

  /** Effect time in seconds. Set it to scrub or to render a fixed frame; while motion is off, effects keep the frozen time. */
  get time(): number {
    return this.#time;
  }
  set time(seconds: number) {
    this.#time = seconds;
  }

  /** The passes the last render used, in order (for inspection and tests). */
  /** Whether GPU timing is on; turning it on takes effect from the next render. */
  get timing(): boolean {
    return this.#timing;
  }
  set timing(value: boolean) {
    this.#timing = value;
    if (!value) {
      this.#timer?.dispose();
      this.#timer = null;
    }
  }

  /**
   * GPU milliseconds from the latest measured frame, by span: `scene`,
   * `prepasses` and `pass 0`, `pass 1`… Null when timing is off or the GPU
   * has no timer queries. Results lag a frame or two behind.
   */
  get timings(): Readonly<Record<string, number>> | null {
    return this.#timer?.supported ? this.#timer.latest : null;
  }

  /** A summary of the last render's passes, for inspectors and overlays. */
  describe(): {
    readonly label: string;
    readonly effects: readonly string[];
    readonly compiles: number;
    readonly buffers: readonly string[];
    readonly gpuMs: number | null;
    readonly source: string;
  }[] {
    const timings = this.timings;
    return this.#plan.map((step, index) => {
      const label = `pass ${index}`;
      const gpuMs = timings?.[label] ?? null;
      if (step.kind === 'foreign')
        return {
          label,
          effects: [step.pass.constructor?.name ?? 'pass'],
          compiles: 0,
          buffers: [],
          gpuMs,
          source: '',
        };
      return {
        label,
        effects: step.pass.effects.map((e) => e.name),
        compiles: step.pass.compiles,
        buffers: [...step.pass.buffers],
        gpuMs,
        source: step.pass.source,
      };
    });
  }

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
    const measured =
      delta ??
      (this.#lastTime === undefined ? 0 : (now - this.#lastTime) / 1000);
    this.#lastTime = now;
    const seconds = this.#playing ? measured : 0;
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

    const active = this.effects.filter((effect) => effect.enabled);
    const buffers = new Set(active.flatMap((e) => e.requiredBuffers()));
    this.#useDepthTexture(buffers.has('depth'));

    const previousTarget = renderer.getRenderTarget();
    const sceneTarget = this.#sceneTarget!;
    renderer.setRenderTarget(sceneTarget);
    const timer = this.#ensureTimer();
    const measure = (label: string, run: () => void) =>
      timer ? timer.measure(label, run) : run();
    measure('scene', () => renderer.render(this.scene!, this.camera!));
    measure('prepasses', () =>
      this.#renderPrepasses(active, buffers.has('normal')),
    );
    const geometry = {
      depth: sceneTarget.depthTexture,
      normal: this.#normal?.target.texture ?? null,
      camera: this.camera,
    };

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
        pass.setGeometry(geometry);
        pass.setInputs(this.inputs);
        measure(`pass ${index}`, () =>
          pass.render(renderer, last ? target : write, read, seconds),
        );
      } else {
        step.pass.renderToScreen = false;
        measure(`pass ${index}`, () =>
          step.pass.render(renderer, write, read, seconds, false),
        );
        if (step.pass.needsSwap === false) return;
      }
      if (!last) {
        read = write;
        [write, spare] = [spare, write];
      }
    });
    renderer.setRenderTarget(previousTarget);
    timer?.endFrame();
    this.stats.compiles = this.#countCompiles();
  }

  /** Disposes passes, buffers and every effect in the stack. Safe to call more than once. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#unsubscribe?.();
    for (const step of this.#plan) step.pass.dispose?.();
    this.#outputPass?.dispose();
    for (const item of this.#items) item.dispose?.();
    this.#sceneTarget?.dispose();
    this.#targets?.forEach((t) => t.dispose());
    this.#normal?.dispose();
    this.#normal = null;
    for (const prepass of this.#selections.values()) prepass.dispose();
    this.#selections.clear();
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
    this.#normal?.setSize(width, height);
    for (const prepass of this.#selections.values())
      prepass.setSize(width, height);
    this.stats.allocations++;
  }

  #ensureTimer(): GpuTimer | null {
    if (!this.#timing) return null;
    this.#timer ??= new GpuTimer(
      this.renderer.getContext() as WebGL2RenderingContext,
    );
    return this.#timer.supported ? this.#timer : null;
  }

  /** Gives the scene target a depth texture only while an effect reads depth. */
  #useDepthTexture(needed: boolean): void {
    const target = this.#sceneTarget!;
    this.stats.depth = needed;
    if (needed === Boolean(target.depthTexture)) return;
    // A render target's depth attachment is fixed once it is set up, so swap the target.
    target.dispose();
    this.#sceneTarget = new WebGLRenderTarget(this.#width, this.#height, {
      type: this.#options.frameBufferType,
      samples: this.#options.multisampling,
      ...(needed
        ? { depthTexture: new DepthTexture(this.#width, this.#height) }
        : {}),
    });
    if (!needed) target.depthTexture?.dispose();
    this.stats.allocations++;
  }

  /** The normal prepass and selection masks the active effects need. */
  #renderPrepasses(active: readonly Effect[], normals: boolean): void {
    const { renderer, scene, camera } = this;
    const samples = this.#options.multisampling;
    let prepasses = 0;
    if (normals) {
      this.#normal ??= new NormalPrepass(this.#width, this.#height, samples);
      this.#normal.render(renderer, scene!, camera!);
      prepasses++;
    } else if (this.#normal) {
      this.#normal.dispose();
      this.#normal = null;
    }
    const used = new Set<EffectMask>();
    for (const effect of active) {
      const mask = effect.mask;
      if (!mask || effect.maskKind !== 'selection') continue;
      let prepass = this.#selections.get(mask);
      if (!prepass) {
        prepass = new SelectionPrepass(this.#width, this.#height, samples);
        this.#selections.set(mask, prepass);
      }
      if (!used.has(mask)) {
        prepass.render(renderer, scene!, camera!, mask as SelectionMask);
        used.add(mask);
        prepasses++;
      }
      effect.uniforms.xtMask!.value = prepass.target.texture;
    }
    for (const [mask, prepass] of this.#selections) {
      if (used.has(mask)) continue;
      prepass.dispose();
      this.#selections.delete(mask);
    }
    this.stats.prepasses = prepasses;
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
