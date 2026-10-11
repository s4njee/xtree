/**
 * The parameter schema DSL. Every effect declares its parameters with these
 * builders; the schema drives TypeScript types, validation, uniforms,
 * presets, serialization and the documentation controls.
 */

interface BaseParam<K extends string, V> {
  readonly kind: K;
  readonly default: V;
  /** One sentence for docs and tooltips. */
  readonly description: string;
  /** Control label; defaults to the parameter name in sentence case. */
  readonly label?: string;
  /** Groups related controls in the docs. */
  readonly group?: string;
  /**
   * Structural parameters compile into the shader as `#define`s. Changing one
   * recompiles the pass that contains the effect; changing any other
   * parameter only updates a uniform.
   */
  readonly structural?: boolean;
}

interface RangeOptions {
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  /** Shown next to values in the docs, for example "px" or "°". */
  readonly unit?: string;
}

export interface FloatParam extends BaseParam<'float', number>, RangeOptions {}
export interface IntParam extends BaseParam<'int', number>, RangeOptions {}
export type BoolParam = BaseParam<'bool', boolean>;
/** A color written as a CSS hex string (sRGB); the uniform holds linear RGB. */
export type ColorParam = BaseParam<'color', string>;
export interface Vec2Param
  extends BaseParam<'vec2', readonly [number, number]>, RangeOptions {}
export interface Vec3Param
  extends BaseParam<'vec3', readonly [number, number, number]>, RangeOptions {}
export interface SelectParam<O extends string = string> extends BaseParam<
  'select',
  O
> {
  readonly options: readonly O[];
  /** Display names for options; defaults to the option in sentence case. */
  readonly optionLabels?: Partial<Record<O, string>>;
}

export type Param =
  | FloatParam
  | IntParam
  | BoolParam
  | ColorParam
  | Vec2Param
  | Vec3Param
  | SelectParam;
export type ParamSchema = Readonly<Record<string, Param>>;
export type ParamKind = Param['kind'];

/** The value type a parameter accepts. */
export type ParamValue<P extends Param> =
  P extends SelectParam<infer O>
    ? O
    : P extends BoolParam
      ? boolean
      : P extends ColorParam
        ? string
        : P extends Vec2Param
          ? readonly [number, number]
          : P extends Vec3Param
            ? readonly [number, number, number]
            : number;

/** Values for a whole schema. */
export type ParamValues<S extends ParamSchema> = {
  -readonly [K in keyof S]: ParamValue<S[K]>;
};

type Options<P> = Omit<P, 'kind'>;

export const float = (options: Options<FloatParam>): FloatParam => ({
  kind: 'float',
  ...options,
});
export const int = (options: Options<IntParam>): IntParam => ({
  kind: 'int',
  ...options,
});
export const bool = (options: Options<BoolParam>): BoolParam => ({
  kind: 'bool',
  ...options,
});
export const color = (options: Options<ColorParam>): ColorParam => ({
  kind: 'color',
  ...options,
});
export const vec2 = (options: Options<Vec2Param>): Vec2Param => ({
  kind: 'vec2',
  ...options,
});
export const vec3 = (options: Options<Vec3Param>): Vec3Param => ({
  kind: 'vec3',
  ...options,
});
export const select = <const O extends string>(
  options: Omit<SelectParam<O>, 'kind' | 'default'> & {
    readonly default: NoInfer<O>;
  },
): SelectParam<O> => ({ kind: 'select', ...options }) as SelectParam<O>;

/** GLSL type of each parameter kind. */
export const glslTypes: Readonly<Record<ParamKind, string>> = {
  float: 'float',
  int: 'int',
  bool: 'bool',
  color: 'vec3',
  vec2: 'vec2',
  vec3: 'vec3',
  select: 'int',
};

const hexPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Converts an sRGB hex color to linear RGB, as three.js ColorManagement does. */
export function hexToLinear(hex: string): [number, number, number] {
  const full =
    hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const value = Number.parseInt(full.slice(1), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [channel(16), channel(8), channel(0)];
}

/**
 * Checks a value against its parameter. Throws a TypeError for the wrong
 * type and a RangeError for a value outside the declared range; both name
 * `effect.parameter`.
 */
export function validateParam(
  owner: string,
  name: string,
  param: Param,
  value: unknown,
): void {
  const where = `${owner}.${name}`;
  const fail = (message: string): never => {
    throw new TypeError(`${where}: ${message}`);
  };
  const inRange = (v: number, p: RangeOptions) => {
    if (v < p.min || v > p.max)
      throw new RangeError(`${where}: ${v} is outside [${p.min}, ${p.max}]`);
  };
  switch (param.kind) {
    case 'float':
      if (typeof value !== 'number' || !Number.isFinite(value))
        fail(`expected a finite number, got ${String(value)}`);
      inRange(value as number, param);
      return;
    case 'int':
      if (!Number.isInteger(value))
        fail(`expected an integer, got ${String(value)}`);
      inRange(value as number, param);
      return;
    case 'bool':
      if (typeof value !== 'boolean')
        fail(`expected a boolean, got ${String(value)}`);
      return;
    case 'color':
      if (typeof value !== 'string' || !hexPattern.test(value))
        fail(`expected a hex color such as "#ff8800", got ${String(value)}`);
      return;
    case 'vec2':
    case 'vec3': {
      const length = param.kind === 'vec2' ? 2 : 3;
      if (
        !Array.isArray(value) ||
        value.length !== length ||
        !value.every((v) => typeof v === 'number' && Number.isFinite(v))
      ) {
        fail(`expected ${length} finite numbers, got ${JSON.stringify(value)}`);
      }
      for (const v of value as number[]) inRange(v, param);
      return;
    }
    case 'select':
      if (!param.options.includes(value as string))
        fail(
          `expected one of ${param.options.join(', ')}, got ${String(value)}`,
        );
      return;
  }
}

/** The uniform (or define) representation of a parameter value. */
export function toUniformValue(
  param: Param,
  value: unknown,
): number | boolean | number[] {
  switch (param.kind) {
    case 'color':
      return hexToLinear(value as string);
    case 'vec2':
    case 'vec3':
      return [...(value as number[])];
    case 'select':
      return param.options.indexOf(value as string);
    default:
      return value as number | boolean;
  }
}

/** Sentence-case label from a camelCase name. */
export function labelFor(
  name: string,
  param?: { readonly label?: string },
): string {
  if (param?.label) return param.label;
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
