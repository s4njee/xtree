import type * as THREE from 'three';
import type { ChunkMap } from '../glsl/index.js';
import { blendModes, type BlendMode } from '../shaders/blend/constants.js';
import {
  maskKind,
  validateMask,
  type DepthMask,
  type EffectMask,
  type GeometryBuffer,
  type MaskKind,
} from './mask.js';
import {
  toUniformValue,
  type CurvePoints,
  type GradientStops,
  validateParam,
  type Param,
  type ParamSchema,
  type ParamValue,
  type ParamValues,
  type SampleTexture,
  type TextureLike,
} from './params.js';

/** Effect families, matching the catalogue in plan.md. */
export const effectFamilies = {
  color: 'Color & tone',
  lens: 'Lens & camera',
  glow: 'Blur & glow',
  glitch: 'Glitch & signal',
  retro: 'Retro & display',
  stylize: 'Stylization',
  distortion: 'Distortion & warp',
  atmosphere: 'Atmosphere & lighting',
  holographic: 'Holographic & iridescent',
  material: 'Materials',
  transition: 'Transitions',
  utility: 'Utilities',
} as const;
/** The family an effect belongs to in the catalogue. */
export type EffectFamily = keyof typeof effectFamilies;

/** Documentation and catalogue metadata for an effect. */
export interface EffectMeta {
  /** Display name, for example "Chromatic aberration". */
  readonly title: string;
  readonly family: EffectFamily;
  /** The plan.md story that tracks the effect, for example "X4.1". */
  readonly story: string;
  /** One or two sentences for the docs and the gallery. */
  readonly description: string;
  /** Names of related effects. */
  readonly related?: readonly string[];
  /** How the docs demo and the visual baselines show the effect. */
  readonly demo?: {
    /** Studio objects (by name) to select as the effect's mask. */
    readonly selection?: readonly string[];
  };
}

/**
 * How an effect reads its input:
 * - `pixel`: only the incoming color of its own pixel, so it merges anywhere in a pass.
 * - `input`: samples the pass input at other positions (or renders its own
 *   passes from it), so it starts a new merged pass.
 */
export type Sampling = 'pixel' | 'input';

/**
 * What an animated effect does when motion is off (reduced motion, high
 * contrast or `composer.motion = false`): `static` effects have no motion,
 * `freeze` holds the current time, and `settle` swaps in still parameter values.
 */
export type MotionBehavior<S extends ParamSchema> =
  'static' | 'freeze' | { readonly settle: Partial<ParamValues<S>> };

/** Per-frame information passed to an effect's `prepare`. */
export interface FrameInfo {
  readonly time: number;
  readonly delta: number;
  readonly frame: number;
  readonly width: number;
  readonly height: number;
  /** The geometry buffers this frame, for effects whose own passes read them (null when not rendered). */
  readonly buffers: {
    readonly depth: THREE.Texture | null;
    readonly normal: THREE.Texture | null;
    readonly velocity: THREE.Texture | null;
  };
}

/** GPU resources an `input` effect renders before its pass, such as bloom's mip chain. */
export interface EffectResources {
  /** Called when the pass is resized, in pixels. */
  setSize(width: number, height: number): void;
  /** Called before each frame of the merged pass, to render the effect's own passes. */
  prepare(
    renderer: THREE.WebGLRenderer,
    input: THREE.Texture,
    frame: FrameInfo,
  ): void;
  /** Releases the resources `setup` created. */
  dispose(): void;
}

/**
 * The three.js classes and constants a `setup` may use. The composer passes
 * them in, so effect modules never import three.js (and bundles only include
 * what the composer already uses).
 */
export interface ThreeKit {
  readonly WebGLRenderTarget: typeof THREE.WebGLRenderTarget;
  readonly RawShaderMaterial: typeof THREE.RawShaderMaterial;
  readonly Vector2: typeof THREE.Vector2;
  readonly GLSL3: typeof THREE.GLSL3;
  readonly HalfFloatType: typeof THREE.HalfFloatType;
  readonly LinearFilter: typeof THREE.LinearFilter;
  readonly ClampToEdgeWrapping: typeof THREE.ClampToEdgeWrapping;
}

/** What an effect's `setup` can use: three.js, the renderer, the effect and helpers. */
export interface SetupContext<S extends ParamSchema> {
  readonly three: ThreeKit;
  readonly effect: EffectInstance<S>;
  /** Resolves xtree `#include`s in a standalone shader (for example a downsample pass) against chunk maps. */
  include(source: string, ...chunks: ChunkMap[]): string;
  /** Draws a full-screen triangle with `material` into `target` (null for the canvas). */
  draw(
    renderer: THREE.WebGLRenderer,
    material: THREE.Material,
    target: THREE.WebGLRenderTarget | null,
  ): void;
}

/** Picks buffers from an effect's current values. (The bivariance wrapper keeps specific effects assignable to the general `Effect` type.) */
export type BufferSelector<S extends ParamSchema> = {
  /** Returns the buffers the effect needs with its current values. */
  bivariance(effect: EffectInstance<S>): readonly GeometryBuffer[];
}['bivariance'];

/**
 * How an effect's mask applies:
 * - `opacity`: the mask scales the effect's opacity per pixel.
 * - `custom`: the effect reads the mask itself through `$maskAt(uv)`, for
 *   example to outline a selection or to bloom only selected objects.
 */
export type Masking = 'opacity' | 'custom';

/** Everything `defineEffect` needs to describe a post-processing effect. */
export interface EffectDefinition<S extends ParamSchema> {
  /** Kebab-case id, also the export path: `@mk7s/xtree/effects/<name>`. */
  readonly name: string;
  /** Set by `defineMaterialEffect` and `defineTransition`; post effects leave it out. */
  readonly kind?: 'post' | 'material' | 'transition';
  readonly meta: EffectMeta;
  readonly params: S;
  /** Named parameter sets; each is applied over the defaults. */
  readonly presets?: Readonly<Record<string, Partial<ParamValues<S>>>>;
  readonly sampling?: Sampling;
  readonly motion?: MotionBehavior<S>;
  /**
   * Geometry buffers the fragment reads, or a function of the effect that
   * picks them (it may only depend on structural parameters). Depth gives
   * `xt_depth`, `xt_viewDepth`, `xt_viewPosition` and `xt_worldPosition`;
   * normal gives `xt_viewNormal`. The composer renders only the buffers an
   * enabled effect needs.
   */
  readonly buffers?: readonly GeometryBuffer[] | BufferSelector<S>;
  /** Defaults to `opacity`. */
  readonly masking?: Masking;
  /** Chunk maps the fragment includes from. */
  readonly chunks?: readonly ChunkMap[];
  /** Extra sampler uniforms that `setup` fills, referenced as `$name`. */
  readonly textures?: readonly string[];
  /**
   * GLSL ES 3.00 defining `vec4 $main(vec4 color, vec2 uv)`. `$name` refers
   * to the effect's own parameters, textures and helper functions; the
   * compiler renames them per effect so effects merge into one shader. Use
   * `xt_sample(uv)` to read the pass input and `xt_time`, `xt_resolution`
   * and `xt_texel` for frame data.
   */
  readonly fragment: string;
  /**
   * Creates per-instance GPU resources for multi-pass effects. (Method syntax
   * keeps specific effects assignable to the general `Effect` type.)
   */
  setup?(context: SetupContext<S>): EffectResources;
}

/** Options every effect takes besides its parameters. */
export interface EffectOptions {
  readonly preset?: string;
  readonly blend?: BlendMode;
  readonly opacity?: number;
  readonly enabled?: boolean;
  /** Limits where the effect applies; see `Effect.mask`. */
  readonly mask?: EffectMask | null;
}

/** An effect's settings as plain JSON, from `effect.toJSON()`. */
export interface EffectJSON {
  readonly effect: string;
  readonly params?: Record<string, unknown>;
  readonly blend?: BlendMode;
  readonly opacity?: number;
  readonly enabled?: boolean;
  /** Depth masks only; texture and selection masks hold live objects. */
  readonly mask?: DepthMask;
}

/** An effect instance with a typed property per parameter. */
export type EffectInstance<S extends ParamSchema> = Effect<S> & ParamValues<S>;

/** Creates instances of an effect; `definition` describes it. */
export interface EffectFactory<S extends ParamSchema> {
  /** Creates an effect with any parameter values, a `preset`, a `mask` and blending options. */
  (values?: Partial<ParamValues<S>> & EffectOptions): EffectInstance<S>;
  readonly definition: EffectDefinition<S>;
}

const reserved = new Set([
  'blend',
  'preset',
  'opacity',
  'enabled',
  'definition',
  'uniforms',
  'id',
  'name',
  'resources',
  'structureVersion',
  'disposed',
  'get',
  'set',
  'reset',
  'applyPreset',
  'changed',
  'toJSON',
  'setMotion',
  'structuralValues',
  'onDispose',
  'dispose',
  'resolveSamples',
  'mask',
  'maskAt',
  'requiredBuffers',
  'maskKind',
  'onStructureChange',
  'time',
  'tick',
  'xtMask',
  'xtMaskChannel',
  'xtMaskRange',
  'xtMaskInvert',
]);

let nextId = 1;

/** One configured effect. Create instances with an effect factory, for example `vignette({ darkness: 0.6 })`. */
export class Effect<S extends ParamSchema = ParamSchema> {
  readonly definition: EffectDefinition<S>;
  /** Unique per instance; the compiler and composer key passes by it. */
  readonly id = nextId++;
  /** Uniform objects keyed by parameter or texture name, plus `opacity`. Shared with every compiled pass. */
  readonly uniforms: Record<string, { value: unknown }> = {};
  /** GPU resources created by the composer for `setup` effects. */
  resources: EffectResources | null = null;
  #values: Record<string, unknown> = {};
  #blend: BlendMode = 'normal';
  #enabled = true;
  #version = 0;
  #motion = true;
  #disposed = false;
  #disposers: (() => void)[] = [];
  #samples = new Map<string, TextureLike & { dispose(): void }>();
  /** Gradient and curve textures, rebuilt when their value changes. */
  #baked = new Map<
    string,
    { key: string; texture: TextureLike & { dispose(): void } }
  >();
  #mask: EffectMask | null = null;
  readonly #listeners = new Set<() => void>();

  constructor(
    definition: EffectDefinition<S>,
    options: Partial<ParamValues<S>> & EffectOptions = {},
  ) {
    this.definition = definition;
    for (const [name, param] of Object.entries(definition.params) as [
      string,
      Param,
    ][]) {
      this.#values[name] = param.default;
      this.uniforms[name] = { value: toUniformValue(param, param.default) };
    }
    for (const texture of definition.textures ?? [])
      this.uniforms[texture] = { value: null };
    this.uniforms.opacity = { value: 1 };
    this.uniforms.xtMask = { value: null };
    this.uniforms.xtMaskChannel = { value: 0 };
    this.uniforms.xtMaskRange = { value: [0, 0, 0] };
    this.uniforms.xtMaskInvert = { value: false };
    const { preset, blend, opacity, enabled, mask, ...values } = options;
    if (preset !== undefined) this.applyPreset(preset);
    this.set(values as unknown as Partial<ParamValues<S>>);
    if (blend !== undefined) this.blend = blend;
    if (opacity !== undefined) this.opacity = opacity;
    if (enabled !== undefined) this.enabled = enabled;
    if (mask !== undefined) this.mask = mask;
  }

  get name(): string {
    return this.definition.name;
  }

  /** Increases whenever the compiled shader must change: structural parameters, blend mode, enabled state or motion settling. */
  get structureVersion(): number {
    return this.#version;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get blend(): BlendMode {
    return this.#blend;
  }
  set blend(mode: BlendMode) {
    if (!(mode in blendModes))
      throw new TypeError(
        `${this.name}.blend: unknown blend mode ${String(mode)}`,
      );
    if (mode !== this.#blend) {
      this.#blend = mode;
      this.#bump();
    }
  }

  /** Mix between the input and the effect's result, 0 to 1. */
  get opacity(): number {
    return this.uniforms.opacity!.value as number;
  }
  set opacity(value: number) {
    if (typeof value !== 'number' || !(value >= 0 && value <= 1)) {
      throw new RangeError(
        `${this.name}.opacity: ${String(value)} is outside [0, 1]`,
      );
    }
    this.uniforms.opacity!.value = value;
  }

  get enabled(): boolean {
    return this.#enabled;
  }
  set enabled(value: boolean) {
    if (value !== this.#enabled) {
      this.#enabled = Boolean(value);
      this.#bump();
    }
  }

  /**
   * Limits where the effect applies: one channel of a texture
   * (`{ texture, channel }`), a range of distances from the camera
   * (`{ depth: [near, far], feather }`) or a set of objects
   * (`{ selection: [mesh, group] }` or `{ selection: { layer: 1 } }`). Every
   * kind takes `invert`. Null applies everywhere.
   */
  get mask(): EffectMask | null {
    return this.#mask;
  }
  set mask(mask: EffectMask | null) {
    validateMask(this.name, mask);
    const before = this.maskKind;
    this.#mask = mask;
    const u = this.uniforms;
    u.xtMaskInvert!.value = mask?.invert ?? false;
    u.xtMask!.value = mask && 'texture' in mask ? mask.texture : null;
    u.xtMaskChannel!.value =
      mask && 'texture' in mask ? 'rgba'.indexOf(mask.channel ?? 'r') : 0;
    u.xtMaskRange!.value =
      mask && 'depth' in mask
        ? [mask.depth[0], mask.depth[1], mask.feather ?? 0]
        : [0, 0, 0];
    if (this.maskKind !== before) this.#bump();
  }

  /** The kind of the current mask, or null. */
  get maskKind(): MaskKind | null {
    return this.#mask ? maskKind(this.#mask) : null;
  }

  /** Geometry buffers this effect needs now: its own, plus depth for a depth mask. */
  requiredBuffers(): readonly GeometryBuffer[] {
    const { buffers } = this.definition;
    const own =
      typeof buffers === 'function'
        ? buffers(this as unknown as EffectInstance<S>)
        : (buffers ?? []);
    return this.maskKind === 'depth' && !own.includes('depth')
      ? [...own, 'depth']
      : own;
  }

  /** The current value of a parameter. */
  get<K extends keyof S & string>(name: K): ParamValue<S[K]> {
    if (!(name in this.definition.params))
      throw new TypeError(`${this.name}: unknown parameter ${name}`);
    return this.#values[name] as ParamValue<S[K]>;
  }

  /** Sets several parameters at once. Unknown names and invalid values throw before anything changes. */
  set(values: Partial<ParamValues<S>>): this {
    const entries = Object.entries(values).filter(([, v]) => v !== undefined);
    for (const [name, value] of entries) {
      const param = this.definition.params[name] as Param | undefined;
      if (!param)
        throw new TypeError(`${this.name}: unknown parameter ${name}`);
      validateParam(this.name, name, param, value);
    }
    for (const [name, value] of entries) {
      const param = this.definition.params[name] as Param;
      const previous = this.#values[name];
      this.#values[name] = Array.isArray(value)
        ? Object.freeze([...value])
        : value;
      if (param.structural && !sameValue(previous, value)) this.#bump();
      // A texture parameter's presence ($has_<name>) is compiled in.
      if (param.kind === 'texture' && (previous === null) !== (value === null))
        this.#bump();
      if (!this.#settled(name))
        this.uniforms[name]!.value = toUniformValue(param, value);
    }
    return this;
  }

  /**
   * Fills texture uniforms whose value is a sample name, creating each sample
   * once with `create` (the composer passes a three.js factory). Created
   * textures belong to the effect and are disposed with it.
   */
  resolveSamples(
    create: (sample: SampleTexture) => TextureLike & { dispose(): void },
  ): void {
    for (const [name, param] of Object.entries(this.definition.params) as [
      string,
      Param,
    ][]) {
      if (param.kind === 'gradient' || param.kind === 'curve') {
        const value = this.#values[name];
        const key = `${name}:${JSON.stringify(value)}`;
        const current = this.#baked.get(name);
        if (current?.key !== key) {
          current?.texture.dispose();
          const texture = create(
            param.kind === 'gradient'
              ? { kind: 'gradient', stops: value as GradientStops }
              : { kind: 'curve', points: value as CurvePoints },
          );
          this.#baked.set(name, { key, texture });
        }
        this.uniforms[name]!.value = this.#baked.get(name)!.texture;
        continue;
      }
      if (param.kind !== 'texture') continue;
      const value = this.#values[name];
      if (typeof value !== 'string') continue;
      const key = `${name}:${value}`;
      let texture = this.#samples.get(key);
      if (!texture) {
        texture = create(param.samples![value]!());
        this.#samples.set(key, texture);
      }
      this.uniforms[name]!.value = texture;
    }
  }

  /** Restores every parameter to its default. */
  reset(): this {
    const defaults = Object.fromEntries(
      Object.entries(this.definition.params).map(([name, p]) => [
        name,
        p.default,
      ]),
    );
    return this.set(defaults as Partial<ParamValues<S>>);
  }

  /** Resets to the defaults, then applies a named preset. */
  applyPreset(name: string): this {
    const preset = this.definition.presets?.[name];
    if (!preset) throw new TypeError(`${this.name}: unknown preset ${name}`);
    return this.reset().set(preset);
  }

  /** Parameters that differ from their defaults. */
  changed(): Partial<ParamValues<S>> {
    const out: Record<string, unknown> = {};
    for (const [name, param] of Object.entries(this.definition.params)) {
      if (!sameValue(this.#values[name], param.default))
        out[name] = this.#values[name];
    }
    return out as Partial<ParamValues<S>>;
  }

  /** Serializable state. Texture objects are left out; sample names are kept. */
  toJSON(): EffectJSON {
    const params = Object.fromEntries(
      Object.entries(this.changed()).filter(
        ([, value]) =>
          typeof value !== 'object' || value === null || Array.isArray(value),
      ),
    );
    return {
      effect: this.name,
      ...(Object.keys(params).length ? { params } : {}),
      ...(this.#blend !== 'normal' ? { blend: this.#blend } : {}),
      ...(this.opacity !== 1 ? { opacity: this.opacity } : {}),
      ...(!this.#enabled ? { enabled: false } : {}),
      ...(this.#mask && 'depth' in this.#mask ? { mask: this.#mask } : {}),
    };
  }

  /**
   * Applies the motion policy. With motion off, `settle` effects show their
   * still values (without changing the stored parameters) and the composer
   * stops advancing time.
   */
  setMotion(allowed: boolean): void {
    if (allowed === this.#motion) return;
    this.#motion = allowed;
    const settle = this.#settleValues();
    if (!settle) return;
    let structural = false;
    for (const name of Object.keys(settle)) {
      const param = this.definition.params[name] as Param;
      const value = allowed
        ? this.#values[name]
        : (settle as Record<string, unknown>)[name];
      if (param.structural) structural = true;
      this.uniforms[name]!.value = toUniformValue(param, value);
    }
    if (structural) this.#bump();
  }

  /** Values of structural parameters as compiled, after motion settling. */
  structuralValues(): Record<string, number | boolean | number[]> {
    const out: Record<string, number | boolean | number[]> = {};
    for (const [name, param] of Object.entries(this.definition.params) as [
      string,
      Param,
    ][]) {
      if (param.kind === 'texture') {
        out[`has_${name}`] = this.#values[name] !== null;
        continue;
      }
      if (!param.structural) continue;
      const settle = this.#settled(name)
        ? (this.#settleValues() as Record<string, unknown>)[name]
        : this.#values[name];
      out[name] = toUniformValue(param, settle) as number | boolean | number[];
    }
    return out;
  }

  /**
   * Calls `listener` whenever `structureVersion` changes (the compiled
   * shader must change). Returns a function that removes the listener.
   */
  onStructureChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #bump(): void {
    this.#version++;
    for (const listener of [...this.#listeners]) listener();
  }

  /** Registers cleanup to run once on dispose. */
  onDispose(callback: () => void): void {
    this.#disposers.push(callback);
  }

  /** Releases GPU resources. Safe to call more than once. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.resources?.dispose();
    this.resources = null;
    for (const texture of this.#samples.values()) texture.dispose();
    this.#samples.clear();
    for (const { texture } of this.#baked.values()) texture.dispose();
    this.#baked.clear();
    for (const dispose of this.#disposers.splice(0)) dispose();
    this.#listeners.clear();
  }

  #settleValues(): Partial<ParamValues<S>> | null {
    const motion = this.definition.motion;
    return motion && typeof motion === 'object' ? motion.settle : null;
  }

  #settled(name: string): boolean {
    const settle = this.#settleValues();
    return !this.#motion && settle !== null && name in settle;
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  return a === b;
}

const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const identifierPattern = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Declares an effect and returns its factory. The definition is validated
 * once: parameter names, defaults, presets and the presence of `$main`.
 */
export function defineEffect<const S extends ParamSchema>(
  definition: EffectDefinition<S>,
): EffectFactory<S> {
  return buildFactory(definition, Effect, {
    pattern: /\$main\s*\(/,
    message: 'fragment must define $main(vec4 color, vec2 uv)',
  }) as EffectFactory<S>;
}

/**
 * Validates a definition (parameter names, defaults, presets and its GLSL
 * entry point) and returns a factory of `Base` instances with a typed
 * accessor per parameter. Shared by post and material effects.
 * @internal
 */
export function buildFactory<S extends ParamSchema>(
  definition: EffectDefinition<S>,
  Base: new (
    definition: EffectDefinition<S>,
    values?: Partial<ParamValues<S>> & EffectOptions,
  ) => Effect<S>,
  entry: { readonly pattern: RegExp; readonly message: string },
): (values?: Partial<ParamValues<S>> & EffectOptions) => Effect<S> {
  const { name } = definition;
  if (!namePattern.test(name))
    throw new TypeError(`defineEffect: "${name}" must be kebab-case`);
  for (const [param, spec] of Object.entries(definition.params) as [
    string,
    Param,
  ][]) {
    if (!identifierPattern.test(param))
      throw new TypeError(
        `${name}: parameter "${param}" must be a camelCase identifier`,
      );
    if (reserved.has(param))
      throw new TypeError(`${name}: parameter "${param}" is a reserved name`);
    validateParam(name, param, spec, spec.default);
  }
  for (const texture of definition.textures ?? []) {
    if (texture in definition.params || reserved.has(texture))
      throw new TypeError(
        `${name}: texture "${texture}" clashes with a parameter or reserved name`,
      );
  }
  for (const [preset, values] of Object.entries(definition.presets ?? {})) {
    for (const [param, value] of Object.entries(
      values as Record<string, unknown>,
    )) {
      const spec = definition.params[param] as Param | undefined;
      if (!spec)
        throw new TypeError(
          `${name}: preset ${preset} sets unknown parameter ${param}`,
        );
      validateParam(`${name} preset ${preset}`, param, spec, value);
    }
  }
  if (!entry.pattern.test(definition.fragment))
    throw new TypeError(`${name}: ${entry.message}`);

  // One subclass per definition carries a typed accessor for each parameter.
  class Instance extends Base {}
  for (const param of Object.keys(definition.params)) {
    Object.defineProperty(Instance.prototype, param, {
      get(this: Effect<S>) {
        return this.get(param as keyof S & string);
      },
      set(this: Effect<S>, value: unknown) {
        this.set({ [param]: value } as Partial<ParamValues<S>>);
      },
      enumerable: true,
    });
  }
  const factory = (values?: Partial<ParamValues<S>> & EffectOptions) =>
    new Instance(definition, values);
  Object.defineProperty(factory, 'definition', {
    value: definition,
    enumerable: true,
  });
  return factory;
}
