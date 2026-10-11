/**
 * Transitions blend from one image to another as `progress` goes from 0 to
 * 1. They run standalone (`createTransition` in `@mk7s/xtree/core`) or as a
 * HoloCSS `ThreeEffect` (`toHoloEffect`). They share the parameter schema,
 * presets and serialization of post effects.
 */
import type { ChunkMap } from '../glsl/index.js';
import type { EffectDefinition, EffectMeta, EffectOptions } from './define.js';
import { buildFactory, Effect } from './define.js';
import type { ParamSchema, ParamValues } from './params.js';

/**
 * The CSS transition HoloCSS falls back to when WebGL is unavailable, one of
 * the fallbacks its `ThreeEffect` contract allows.
 */
export type HoloFallback =
  'hcss-depth' | 'hcss-fold' | 'hcss-flip-y' | 'hcss-swing-left';

export interface TransitionDefinition<S extends ParamSchema> {
  /** Kebab-case id, also the export path: `@mk7s/xtree/effects/<name>`. */
  readonly name: string;
  readonly meta: EffectMeta;
  readonly params: S;
  readonly presets?: Readonly<Record<string, Partial<ParamValues<S>>>>;
  readonly chunks?: readonly ChunkMap[];
  /** HoloCSS's CSS fallback for this transition. */
  readonly fallback: HoloFallback;
  /**
   * GLSL ES 3.00 defining `vec4 $transition(vec2 uv, float progress)`. Read
   * the two images with `xt_from(uv)` and `xt_to(uv)` (linear color), their
   * size in pixels with `xt_size()`, and the theme accent with `xt_accent`
   * (linear RGB). At progress 0 it should return the `from` image and at 1
   * the `to` image.
   */
  readonly fragment: string;
}

/** A configured transition. */
export class Transition<S extends ParamSchema = ParamSchema> extends Effect<S> {
  get transitionDefinition(): TransitionDefinition<S> {
    return this.definition as unknown as TransitionDefinition<S>;
  }
}

export type TransitionInstance<S extends ParamSchema> = Transition<S> &
  ParamValues<S>;

export interface TransitionFactory<S extends ParamSchema> {
  (values?: Partial<ParamValues<S>> & EffectOptions): TransitionInstance<S>;
  readonly definition: TransitionDefinition<S> & {
    readonly kind: 'transition';
  };
}

const fallbacks = new Set<HoloFallback>([
  'hcss-depth',
  'hcss-fold',
  'hcss-flip-y',
  'hcss-swing-left',
]);

/** Declares a transition and returns its factory. */
export function defineTransition<const S extends ParamSchema>(
  definition: TransitionDefinition<S>,
): TransitionFactory<S> {
  if (!fallbacks.has(definition.fallback))
    throw new TypeError(
      `${definition.name}: fallback must be one of ${[...fallbacks].join(', ')}`,
    );
  const full = { ...definition, kind: 'transition' as const };
  return buildFactory(
    full as unknown as EffectDefinition<S>,
    Transition as unknown as new (
      definition: EffectDefinition<S>,
      values?: Partial<ParamValues<S>> & EffectOptions,
    ) => Effect<S>,
    {
      pattern: /\$transition\s*\(/,
      message: 'fragment must define $transition(vec2 uv, float progress)',
    },
  ) as unknown as TransitionFactory<S>;
}
