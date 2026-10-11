/**
 * `@mk7s/xtree/core`: the composer, passes, material patching, transitions, inputs and debugging. The only entry that loads three.js.
 *
 * @module core
 */
export {
  EffectComposer,
  type ComposerStats,
  type EffectComposerOptions,
} from './composer.js';
export { EffectPass, describePassError } from './pass.js';
export {
  compilePass,
  passSignature,
  renameEffectSource,
  type CompiledPass,
  type OutputStage,
  type ToneMapping,
} from './compile.js';
export {
  planPasses,
  type ForeignPass,
  type PassGroup,
  type StackItem,
} from './plan.js';
export { Fullscreen } from './fullscreen.js';
export { createSampleTexture } from './textures.js';
export { patchMaterial, unpatchMaterial, materialEffects } from './material.js';
export {
  compileMaterial,
  materialPrefix,
  materialSignature,
  type MaterialInjection,
} from './material-compile.js';
export {
  createTransition,
  toHoloEffect,
  type HoloThreeEffect,
  type TransitionOptions,
  type TransitionPlayer,
} from './transition.js';
export {
  compileHoloFragment,
  compileTransition,
  type CompiledTransition,
} from './transition-compile.js';
export {
  trackAudio,
  trackPointer,
  trackScroll,
  type InputTarget,
} from './interaction.js';
export type { PassGeometry, PassInputs } from './pass.js';
export { createDebugOverlay, type DebugOverlay } from './debug.js';
export { GpuTimer } from './timing.js';
export {
  FrameGovernor,
  type GovernorOptions,
  type GovernorState,
} from './governor.js';
