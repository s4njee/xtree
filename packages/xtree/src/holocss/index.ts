/**
 * HoloCSS integration: the only entry that imports `@mk7s/holocss` (an
 * optional peer dependency). Effects follow the HoloCSS theme roles with
 * {@link bindTheme} and HoloCSS's motion policy with {@link bindMotion}.
 *
 * @module holocss
 */
import { motionAllowed, watchMotion } from '@mk7s/holocss/runtime';
import {
  bindMotion as bindPolicy,
  type MotionPolicy,
  type MotionTarget,
} from '../motion/index.js';

export {
  applyTheme,
  bindTheme,
  resolveTheme,
  themeRoles,
  type BindThemeOptions,
  type ThemeColors,
  type ThemedAccent,
  type ThemedEffect,
  type ThemeTarget,
} from './theme.js';
export type { ThemeRole } from '../effect/params.js';
export type { MotionTarget } from '../motion/index.js';

/** HoloCSS's own motion policy, from `@mk7s/holocss/runtime`. */
export const holocssMotion: MotionPolicy = { motionAllowed, watchMotion };

/**
 * Keeps targets (composers and effects) in step with HoloCSS's motion policy
 * for `element`: OS reduced motion, `data-hcss-motion="none"` and the
 * high-contrast theme all stop motion. Returns a function that stops
 * following it. Without HoloCSS, `bindMotion` from `@mk7s/xtree/motion`
 * applies the same rule.
 *
 * ```ts
 * const unbind = bindMotion([composer, hologram], canvas);
 * ```
 */
export function bindMotion(
  targets: MotionTarget | readonly MotionTarget[],
  element: Element,
): () => void {
  return bindPolicy(targets, element, holocssMotion);
}
