import {
  Color,
  GLSL3,
  RawShaderMaterial,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import type { HoloFallback, Transition } from '../effect/transition.js';
import { fullscreenVertex } from '../effect/fullscreen-vertex.js';
import { Fullscreen } from './fullscreen.js';
import { createSampleTexture } from './textures.js';
import {
  compileHoloFragment,
  compileTransition,
} from './transition-compile.js';

export interface TransitionOptions {
  /** The outgoing image. Mark sRGB images (photos, DOM captures) with `colorSpace = SRGBColorSpace`. */
  readonly from: Texture;
  /** The incoming image. */
  readonly to: Texture;
  /** Theme accent some transitions draw with, as a CSS hex color. Defaults to `#7cc4ff`. */
  readonly accent?: string;
}

/** A transition between two textures, rendered on demand. */
export interface TransitionPlayer {
  /** 0 shows `from`, 1 shows `to`. Values are clamped. */
  progress: number;
  from: Texture;
  to: Texture;
  readonly transition: Transition;
  /** Sets the accent color from a CSS hex string. */
  setAccent(hex: string): void;
  /**
   * Renders the current frame to the canvas, or into `target`. The canvas
   * gets the renderer's output color space; a target gets linear color.
   */
  render(target?: WebGLRenderTarget | null): void;
  /** Releases the shader; the textures belong to the caller. */
  dispose(): void;
}

/**
 * Runs a transition outside HoloCSS: drive `progress` from your own timeline
 * (or GSAP, or scroll) and call `render()` each frame.
 *
 * ```ts
 * const player = createTransition(renderer, crossfade({ pattern: 'radial' }), { from, to });
 * gsap.to(player, { progress: 1, duration: 1, onUpdate: () => player.render() });
 * ```
 */
export function createTransition(
  renderer: WebGLRenderer,
  transition: Transition,
  options: TransitionOptions,
): TransitionPlayer {
  const fullscreen = new Fullscreen();
  const globals = {
    fromTexture: { value: options.from as Texture },
    toTexture: { value: options.to as Texture },
    progress: { value: 0 },
    accent: { value: new Color(options.accent ?? '#7cc4ff') },
  };
  const materials = new Map<string, RawShaderMaterial>();
  const material = (srgb: boolean) => {
    const key = `${srgb}|${JSON.stringify(transition.structuralValues())}`;
    let found = materials.get(key);
    if (!found) {
      const compiled = compileTransition(transition, { srgb });
      found = new RawShaderMaterial({
        name: `xtree:${transition.name}`,
        glslVersion: GLSL3,
        vertexShader: fullscreenVertex,
        fragmentShader: compiled.fragment,
        uniforms: { ...globals, ...compiled.uniforms },
        depthTest: false,
        depthWrite: false,
      });
      materials.set(key, found);
    }
    return found;
  };
  return {
    transition,
    get progress() {
      return globals.progress.value;
    },
    set progress(value: number) {
      globals.progress.value = Math.min(
        1,
        Math.max(0, Number.isFinite(value) ? value : 0),
      );
    },
    get from() {
      return globals.fromTexture.value;
    },
    set from(texture: Texture) {
      globals.fromTexture.value = texture;
    },
    get to() {
      return globals.toTexture.value;
    },
    set to(texture: Texture) {
      globals.toTexture.value = texture;
    },
    setAccent(hex: string) {
      globals.accent.value.set(hex);
    },
    render(target: WebGLRenderTarget | null = null) {
      transition.resolveSamples(createSampleTexture);
      const srgb =
        target === null && renderer.outputColorSpace === SRGBColorSpace;
      fullscreen.draw(renderer, material(srgb), target);
    },
    dispose() {
      for (const m of materials.values()) m.dispose();
      materials.clear();
      fullscreen.dispose();
    },
  };
}

/**
 * The HoloCSS `ThreeEffect` contract (`@mk7s/holocss/three`), restated so
 * xtree doesn't depend on HoloCSS.
 */
export interface HoloThreeEffect {
  readonly name: string;
  readonly fallback: HoloFallback;
  readonly fragment: string;
  readonly vertex?: string;
}

/**
 * Converts a transition to a HoloCSS `ThreeEffect` for `transition3d()`.
 * Parameter values are baked in when this is called (the contract carries
 * no extra uniforms); call it again after changing them.
 *
 * ```ts
 * import { transition3d } from '@mk7s/holocss/three';
 * await transition3d(from, to, toHoloEffect(crossfade({ pattern: 'noise' })), { target, update });
 * ```
 */
export function toHoloEffect(transition: Transition): HoloThreeEffect {
  const definition = transition.transitionDefinition;
  return {
    name: definition.meta.title,
    fallback: definition.fallback,
    fragment: compileHoloFragment(transition),
  };
}
