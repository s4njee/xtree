/**
 * Masks limit where an effect applies. A mask is a texture channel, a range
 * of distances from the camera, or a selection of objects that the composer
 * renders to a mask buffer each frame.
 */
import type * as THREE from 'three';
import type { TextureLike } from './params.js';

/** A geometry buffer an effect reads: `depth` (the scene's depth texture) or `normal` (a view-space normal prepass). */
export type GeometryBuffer = 'depth' | 'normal';

/** Mask from one channel of a texture covering the screen. */
export interface TextureMask {
  readonly texture: TextureLike;
  /** Defaults to `r`. */
  readonly channel?: 'r' | 'g' | 'b' | 'a';
  readonly invert?: boolean;
}

/** Mask from distance in front of the camera, in scene units. */
export interface DepthMask {
  /** Near and far distances; the mask is 1 between them. */
  readonly depth: readonly [number, number];
  /** Width of the soft edge on each side, in scene units. Defaults to 0. */
  readonly feather?: number;
  readonly invert?: boolean;
}

/** Mask from objects: listed objects and their descendants, or every object on a layer. */
export interface SelectionMask {
  readonly selection: readonly THREE.Object3D[] | { readonly layer: number };
  /** Show selected objects through whatever hides them. Defaults to false. */
  readonly xray?: boolean;
  readonly invert?: boolean;
}

export type EffectMask = TextureMask | DepthMask | SelectionMask;
export type MaskKind = 'texture' | 'depth' | 'selection';

/** Compiled mask kinds: 0 for no mask. */
export const maskKinds: Readonly<Record<MaskKind, number>> = {
  texture: 1,
  depth: 2,
  selection: 3,
};

export function maskKind(mask: EffectMask): MaskKind {
  if ('texture' in mask) return 'texture';
  if ('depth' in mask) return 'depth';
  return 'selection';
}

/** Checks a mask, throwing a TypeError or RangeError that names `effect.mask`. */
export function validateMask(owner: string, mask: unknown): void {
  const where = `${owner}.mask`;
  const fail = (message: string): never => {
    throw new TypeError(`${where}: ${message}`);
  };
  if (mask === null) return;
  if (typeof mask !== 'object')
    fail('expected { texture }, { depth } or { selection }, or null');
  const m = mask as Record<string, unknown>;
  const kinds = ['texture', 'depth', 'selection'].filter((k) => k in m);
  if (kinds.length !== 1)
    fail('expected exactly one of texture, depth or selection');
  if ('invert' in m && typeof m.invert !== 'boolean')
    fail('invert must be a boolean');
  if ('texture' in m) {
    if ((m.texture as Partial<TextureLike> | null)?.isTexture !== true)
      fail('texture must be a three.js texture');
    if ('channel' in m && !['r', 'g', 'b', 'a'].includes(m.channel as string))
      fail('channel must be r, g, b or a');
  } else if ('depth' in m) {
    const range = m.depth;
    if (
      !Array.isArray(range) ||
      range.length !== 2 ||
      !range.every((v) => typeof v === 'number' && Number.isFinite(v))
    )
      fail('depth must be [near, far]');
    const [near, far] = range as [number, number];
    if (near < 0 || far < near)
      throw new RangeError(`${where}: depth needs 0 <= near <= far`);
    const feather = m.feather ?? 0;
    if (typeof feather !== 'number' || !(feather >= 0))
      throw new RangeError(`${where}: feather must be a number >= 0`);
  } else {
    const selection = m.selection;
    const layer = (selection as { layer?: unknown } | null)?.layer;
    const valid = Array.isArray(selection)
      ? selection.every(
          (o) => (o as Partial<THREE.Object3D> | null)?.isObject3D === true,
        )
      : Number.isInteger(layer) &&
        (layer as number) >= 0 &&
        (layer as number) < 32;
    if (!valid)
      fail('selection must be an array of objects or { layer: 0–31 }');
    if ('xray' in m && typeof m.xray !== 'boolean')
      fail('xray must be a boolean');
  }
}
