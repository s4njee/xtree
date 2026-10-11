/**
 * Material effects change how a mesh's own material shades, rather than
 * post-processing the image: `patchMaterial()` (in `@mk7s/xtree/core`)
 * splices their GLSL into three.js's built-in materials. They share the
 * parameter schema, presets, serialization and motion policy of post effects.
 */
import type {
  EffectDefinition,
  EffectMeta,
  EffectOptions,
  MotionBehavior,
} from './define.js';
import { buildFactory, Effect } from './define.js';
import type { ChunkMap } from '../glsl/index.js';
import type { ParamSchema, ParamValues } from './params.js';

/** Blending and depth settings a material effect needs, applied while it is patched in. */
export interface MaterialSettings {
  readonly transparent?: boolean;
  readonly depthWrite?: boolean;
  /** `additive` adds the color to what is behind, for glows and holograms. */
  readonly blending?: 'normal' | 'additive';
  /** Draw both faces, for see-through effects. */
  readonly doubleSided?: boolean;
}

/** Everything `defineMaterialEffect` needs to describe a material effect. */
export interface MaterialEffectDefinition<S extends ParamSchema> {
  /** Kebab-case id, also the export path: `@mk7s/xtree/effects/<name>`. */
  readonly name: string;
  readonly meta: EffectMeta;
  readonly params: S;
  readonly presets?: Readonly<Record<string, Partial<ParamValues<S>>>>;
  readonly motion?: MotionBehavior<S>;
  readonly chunks?: readonly ChunkMap[];
  /**
   * GLSL ES 3.00 defining `vec4 $fragment(vec4 color, XtSurface surface)`.
   * It receives the material's lit color in linear HDR (before tone mapping)
   * and returns a new one; it may `discard`. `XtSurface` holds the view-space
   * position, direction to the camera and normal, the world and object
   * positions, and the first UV set. `$time` is the effect's clock.
   */
  readonly fragment: string;
  /**
   * Optional GLSL defining `void $vertex(inout vec3 position, vec3 normal)`,
   * which moves object-space vertices before projection.
   */
  readonly vertex?: string;
  /** Applied to the material while the effect is patched in, and restored after. */
  readonly settings?: MaterialSettings;
}

/** A configured material effect. Patch it into materials with `patchMaterial(material, effect)`. */
export class MaterialEffect<
  S extends ParamSchema = ParamSchema,
> extends Effect<S> {
  #motion = true;

  constructor(
    definition: EffectDefinition<S>,
    values?: Partial<ParamValues<S>> & EffectOptions,
  ) {
    super(definition, values);
    this.uniforms.time = { value: 0 };
  }

  get materialDefinition(): MaterialEffectDefinition<S> {
    return this.definition as unknown as MaterialEffectDefinition<S>;
  }

  /** Seconds on the effect's clock, the `$time` uniform. */
  get time(): number {
    return this.uniforms.time!.value as number;
  }
  set time(seconds: number) {
    this.uniforms.time!.value = seconds;
  }

  /** Advances the clock by `delta` seconds, unless motion is off. */
  tick(delta: number): void {
    if (this.#motion) this.time += delta;
  }

  override setMotion(allowed: boolean): void {
    this.#motion = allowed;
    super.setMotion(allowed);
  }
}

/** An instance with a typed property per parameter. */
export type MaterialEffectInstance<S extends ParamSchema> = MaterialEffect<S> &
  ParamValues<S>;

/** Creates instances of a material effect; `definition` describes it. */
export interface MaterialEffectFactory<S extends ParamSchema> {
  /** Creates a material effect with any parameter values or a `preset`. */
  (values?: Partial<ParamValues<S>> & EffectOptions): MaterialEffectInstance<S>;
  readonly definition: MaterialEffectDefinition<S> & {
    readonly kind: 'material';
  };
}

/** Declares a material effect and returns its factory. */
export function defineMaterialEffect<const S extends ParamSchema>(
  definition: MaterialEffectDefinition<S>,
): MaterialEffectFactory<S> {
  if (
    definition.vertex !== undefined &&
    !/\$vertex\s*\(/.test(definition.vertex)
  )
    throw new TypeError(
      `${definition.name}: vertex must define $vertex(inout vec3 position, vec3 normal)`,
    );
  const full = { ...definition, kind: 'material' as const };
  return buildFactory(
    full as unknown as EffectDefinition<S>,
    MaterialEffect as unknown as new (
      definition: EffectDefinition<S>,
      values?: Partial<ParamValues<S>> & EffectOptions,
    ) => Effect<S>,
    {
      pattern: /\$fragment\s*\(/,
      message: 'fragment must define $fragment(vec4 color, XtSurface surface)',
    },
  ) as unknown as MaterialEffectFactory<S>;
}

/** Whether a factory or definition is a material effect. */
export const isMaterialDefinition = (definition: {
  readonly kind?: string;
}): boolean => definition.kind === 'material';
