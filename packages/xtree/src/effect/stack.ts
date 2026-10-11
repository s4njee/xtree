/**
 * Saving and restoring effect stacks: plain JSON, and a compact URL-safe
 * string for links such as the docs playground's `?stack=`.
 */
import type { BlendMode } from '../shaders/blend/constants.js';
import type { Effect, EffectJSON } from './define.js';
import type { DepthMask } from './mask.js';
import type { ParamSchema } from './params.js';

/** A serialized stack. */
export interface StackJSON {
  readonly version: 1;
  readonly effects: readonly EffectJSON[];
}

/** Factories by effect name, for example `{ vignette, bloom }` or every export of a module. */
export type EffectRegistry = Readonly<
  Record<
    string,
    {
      (values?: Record<string, unknown>): Effect<ParamSchema>;
      readonly definition: { readonly name: string };
    }
  >
>;

export interface FromJSONOptions {
  /** Called for each thing skipped: unknown effects, parameters and keys. Defaults to `console.warn`. */
  readonly warn?: (message: string) => void;
}

const effectKeys = new Set([
  'effect',
  'params',
  'blend',
  'opacity',
  'enabled',
  'mask',
]);

/** Serializes effects in order. Texture and selection masks hold live objects and are left out. */
export function stackToJSON(effects: readonly Effect[]): StackJSON {
  return { version: 1, effects: effects.map((e) => e.toJSON()) };
}

/**
 * Recreates effects from JSON. Unknown effects, parameters and keys are
 * skipped with a warning; invalid values throw, naming the parameter.
 */
export function stackFromJSON(
  json: StackJSON | { readonly effects?: unknown },
  registry: EffectRegistry,
  options: FromJSONOptions = {},
): Effect[] {
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const byName = new Map(
    Object.values(registry)
      .filter((f) => typeof f === 'function' && 'definition' in f)
      .map((f) => [f.definition.name, f]),
  );
  const list = Array.isArray(json.effects) ? (json.effects as unknown[]) : [];
  const out: Effect[] = [];
  list.forEach((raw, index) => {
    const entry = raw as Partial<EffectJSON> & Record<string, unknown>;
    const factory =
      typeof entry.effect === 'string' ? byName.get(entry.effect) : undefined;
    if (!factory) {
      warn(
        `xtree: stack entry ${index}: unknown effect ${String(entry.effect)}`,
      );
      return;
    }
    for (const key of Object.keys(entry))
      if (!effectKeys.has(key))
        warn(`xtree: ${entry.effect}: ignoring unknown key ${key}`);
    const effect = factory();
    const params = (entry.params ?? {}) as Record<string, unknown>;
    const known: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(params)) {
      if (name in (effect.definition.params as object)) known[name] = value;
      else warn(`xtree: ${entry.effect}: ignoring unknown parameter ${name}`);
    }
    effect.set(known as never);
    if (entry.blend !== undefined) effect.blend = entry.blend as BlendMode;
    if (entry.opacity !== undefined) effect.opacity = entry.opacity;
    if (entry.enabled !== undefined) effect.enabled = entry.enabled;
    if (entry.mask !== undefined) effect.mask = entry.mask as DepthMask;
    out.push(effect);
  });
  return out;
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (text: string) => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/** A URL-safe string for a stack (base64url of its JSON). */
export function encodeStack(effects: readonly Effect[] | StackJSON): string {
  const json = Array.isArray(effects)
    ? stackToJSON(effects)
    : (effects as StackJSON);
  return toBase64Url(new TextEncoder().encode(JSON.stringify(json)));
}

/** Parses a string from `encodeStack`. Throws a SyntaxError for malformed input. */
export function decodeStack(text: string): StackJSON {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(fromBase64Url(text)));
  } catch {
    throw new SyntaxError('xtree: not an encoded stack');
  }
  if (
    !json ||
    typeof json !== 'object' ||
    !Array.isArray((json as StackJSON).effects)
  )
    throw new SyntaxError('xtree: not an encoded stack');
  return json as StackJSON;
}

/** Stack serialization under one name: `EffectStack.fromJSON(json, registry)`. */
export const EffectStack = {
  toJSON: stackToJSON,
  fromJSON: stackFromJSON,
  encode: encodeStack,
  decode: decodeStack,
} as const;
