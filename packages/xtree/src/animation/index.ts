/**
 * Animation and interaction (X14): parameter tweening with CSS easing,
 * scrubbable timelines across effects, and bindings to the pointer, device
 * orientation, audio and scroll. Everything works on any xtree effect,
 * material effect or transition, through its own parameter setters.
 *
 * @module animation
 */
export { cssEase, type Ease } from './ease.js';
export {
  animate,
  type AnimateOptions,
  type ParamAnimation,
} from './animate.js';
export {
  timeline,
  type Keyframe,
  type Timeline,
  type Track,
} from './timeline.js';
export {
  bindAudio,
  bindOrientation,
  bindScroll,
  followPointer,
  requestOrientationPermission,
  type BindAudioOptions,
  type BindOrientationOptions,
  type BindScrollOptions,
  type FollowPointerOptions,
} from './bind.js';
export type { Scheduler } from './clock.js';
export type { Animatable } from './values.js';
