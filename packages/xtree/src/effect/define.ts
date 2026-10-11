import type * as THREE from 'three';
import type { ChunkMap } from '../glsl/index.js';
import { blendModes, type BlendMode } from '../shaders/blend/constants.js';
import {
  toUniformValue,
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
} as const;
export type EffectFamily = keyof typeof effectFamilies;

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

export interface FrameInfo {
  readonly time: number;
  readonly delta: number;
  readonly frame: number;
  readonly width: number;
  readonly height: number;
}

/** GPU resources an `input` effect renders before its pass, such as bloom's mip chain. */
export interface EffectResources {
  setSize(width: number, height: number): void;
  prepare(
    renderer: THREE.WebGLRenderer,
    input: THREE.Texture,
    frame: FrameInfo,
  ): void;
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

export interface SetupContext<S extends ParamSchema> {
  readonly three: ThreeKit;
  readonly effect: EffectInstance<S>;
  /** Draws a full-screen triangle with `material` into `target` (null for the canvas). */
  draw(
    renderer: THREE.WebGLRenderer,
    material: THREE.Material,
    target: THREE.WebGLRenderTarget | null,
  ): void;
}

export interface EffectDefinition<S extends ParamSchema> {
  /** Kebab-case id, also the export path: `@mk7s/xtree/effects/<name>`. */
  readonly name: string;
  readonly meta: EffectMeta;
  readonly params: S;
  /** Named parameter sets; each is applied over the defaults. */
  readonly presets?: Readonly<Record<string, Partial<ParamValues<S>>>>;
  readonly sampling?: Sampling;
  readonly motion?: MotionBehavior<S>;
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

export interface EffectOptions {
  readonly preset?: string;
  readonly blend?: BlendMode;
  readonly opacity?: number;
  readonly enabled?: boolean;
}

export interface EffectJSON {
  readonly effect: string;
  readonly params?: Record<string, unknown>;
  readonly blend?: BlendMode;
  readonly opacity?: number;
  readonly enabled?: boolean;
}

/** An effect instance with a typed property per parameter. */
export type EffectInstance<S extends ParamSchema> = Effect<S> & ParamValues<S>;

export interface EffectFactory<S extends ParamSchema> {
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
    const { preset, blend, opacity, enabled, ...values } = options;
    if (preset !== undefined) this.applyPreset(preset);
    this.set(values as unknown as Partial<ParamValues<S>>);
    if (blend !== undefined) this.blend = blend;
    if (opacity !== undefined) this.opacity = opacity;
    if (enabled !== undefined) this.enabled = enabled;
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
      this.#version++;
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
      this.#version++;
    }
  }

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
      if (param.structural && !sameValue(previous, value)) this.#version++;
      // A texture parameter's presence ($has_<name>) is compiled in.
      if (param.kind === 'texture' && (previous === null) !== (value === null))
        this.#version++;
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
    if (structural) this.#version++;
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
    for (const dispose of this.#disposers.splice(0)) dispose();
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
    return a.length === b.length && a.every((v, i) => v === b[i]);
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
  if (!/\$main\s*\(/.test(definition.fragment))
    throw new TypeError(
      `${name}: fragment must define $main(vec4 color, vec2 uv)`,
    );

  // One subclass per definition carries a typed accessor for each parameter.
  class Instance extends Effect<S> {}
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
    new Instance(definition, values) as EffectInstance<S>;
  Object.defineProperty(factory, 'definition', {
    value: definition,
    enumerable: true,
  });
  return factory as EffectFactory<S>;
}
