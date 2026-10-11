import { Effect } from '../effect/define.js';

/** A pass from three.js's examples (or anything with the same shape) placed in an xtree stack. */
export interface ForeignPass {
  enabled?: boolean;
  needsSwap?: boolean;
  renderToScreen?: boolean;
  render(
    renderer: unknown,
    writeBuffer: unknown,
    readBuffer: unknown,
    deltaTime?: number,
    maskActive?: boolean,
  ): void;
  setSize?(width: number, height: number): void;
  dispose?(): void;
}

export type StackItem = Effect | ForeignPass;

export type PassGroup =
  | { readonly kind: 'effects'; readonly effects: readonly Effect[] }
  | { readonly kind: 'foreign'; readonly pass: ForeignPass };

export const isEffect = (item: StackItem): item is Effect =>
  item instanceof Effect;

/**
 * Groups a stack into passes. Consecutive enabled effects share a pass,
 * except that an `input` effect starts a new one (it must read the pass
 * input) and foreign passes stand alone. With `merge` off every effect gets
 * its own pass.
 */
export function planPasses(
  items: readonly StackItem[],
  merge: boolean,
): PassGroup[] {
  const groups: PassGroup[] = [];
  let current: Effect[] | null = null;
  for (const item of items) {
    if (!isEffect(item)) {
      if (item.enabled !== false) groups.push({ kind: 'foreign', pass: item });
      current = null;
      continue;
    }
    if (!item.enabled) continue;
    if (!merge || current === null || item.definition.sampling === 'input') {
      current = [item];
      groups.push({ kind: 'effects', effects: current });
    } else {
      current.push(item);
    }
  }
  return groups;
}
