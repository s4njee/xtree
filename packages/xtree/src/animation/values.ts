import { hexToLinear } from '../effect/params.js';
import type { Param } from '../effect/params.js';

/** Anything with xtree-style parameters: an effect, material effect or transition. */
export interface Animatable {
  readonly definition: { readonly params: Readonly<Record<string, Param>> };
}

const toHex = (linear: readonly number[]) =>
  `#${linear
    .map((c) => {
      const v = Math.min(1, Math.max(0, c));
      const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(s * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;

/** The parameter definition for `name`, or a TypeError naming the effect. */
export function paramOf(target: Animatable, name: string): Param {
  const param = target.definition.params[name];
  if (!param)
    throw new TypeError(
      `${(target as { name?: string }).name ?? 'effect'}: no parameter "${name}"`,
    );
  return param;
}

/**
 * The value of `param` a fraction `t` of the way from `from` to `to`:
 * numbers and vectors interpolate (ints round), colors interpolate in linear
 * RGB, and everything else switches at the end.
 */
export function interpolate(
  param: Param,
  from: unknown,
  to: unknown,
  t: number,
): unknown {
  switch (param.kind) {
    case 'float':
      return (from as number) + ((to as number) - (from as number)) * t;
    case 'int':
      return Math.round(
        (from as number) + ((to as number) - (from as number)) * t,
      );
    case 'vec2':
    case 'vec3':
      return (from as number[]).map(
        (a, i) => a + ((to as number[])[i]! - a) * t,
      );
    case 'color': {
      const a = hexToLinear(from as string);
      const b = hexToLinear(to as string);
      return toHex(a.map((v, i) => v + (b[i]! - v) * t));
    }
    default:
      return t >= 1 ? to : from;
  }
}

/** Clamps a number or vector to the parameter's declared range. */
export function clampToParam(param: Param, value: unknown): unknown {
  const range = param as { min?: number; max?: number };
  const clamp = (v: number) =>
    Math.min(range.max ?? Infinity, Math.max(range.min ?? -Infinity, v));
  if (typeof value === 'number') return clamp(value);
  if (Array.isArray(value)) return value.map((v) => clamp(v as number));
  return value;
}

/** Sets a parameter through the effect's own accessor, so it validates and updates uniforms. */
export function setParam(
  target: Animatable,
  name: string,
  value: unknown,
): void {
  (target as unknown as Record<string, unknown>)[name] = value;
}

/** Reads a parameter through the effect's own accessor. */
export function getParam(target: Animatable, name: string): unknown {
  const value = (target as unknown as Record<string, unknown>)[name];
  return Array.isArray(value) ? [...value] : value;
}
