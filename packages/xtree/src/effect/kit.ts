import type {
  Material,
  RawShaderMaterial,
  Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { SetupContext } from './define.js';
import { fullscreenVertex } from './fullscreen-vertex.js';
import type { ParamSchema } from './params.js';

/** A render target the kit sizes for you, as a fraction of the pass size. */
export interface KitTarget {
  /** The current target; replaced when the pass resizes or the scale changes. */
  readonly target: WebGLRenderTarget;
  readonly texture: Texture;
  readonly width: number;
  readonly height: number;
  /** Changes the scale; takes effect at once. */
  setScale(scale: number): void;
}

/**
 * Helpers for an effect's `setup` that renders its own passes: full-screen
 * materials, half-float targets sized relative to the pass, and a single
 * `setSize`/`dispose` for all of them.
 *
 * ```ts
 * setup(context) {
 *   const kit = createPassKit(context);
 *   const blur = kit.material(blurSource, { source: { value: null } });
 *   const half = kit.target(0.5);
 *   return {
 *     setSize: kit.setSize,
 *     prepare(renderer, input) {
 *       blur.uniforms.source!.value = input;
 *       kit.draw(renderer, blur, half);
 *       context.effect.uniforms.blurred!.value = half.texture;
 *     },
 *     dispose: kit.dispose,
 *   };
 * }
 * ```
 */
export function createPassKit(context: SetupContext<ParamSchema>) {
  const { three, draw, include } = context;
  const materials: RawShaderMaterial[] = [];
  const targets: {
    scale: number;
    target: WebGLRenderTarget | null;
    key: string;
  }[] = [];
  let width = 1;
  let height = 1;
  const options = {
    type: three.HalfFloatType,
    depthBuffer: false,
    minFilter: three.LinearFilter,
    magFilter: three.LinearFilter,
    wrapS: three.ClampToEdgeWrapping,
    wrapT: three.ClampToEdgeWrapping,
  };
  const ensure = (entry: (typeof targets)[number]) => {
    const w = Math.max(1, Math.round(width * entry.scale));
    const h = Math.max(1, Math.round(height * entry.scale));
    const key = `${w}x${h}`;
    if (entry.target && entry.key === key) return entry.target;
    entry.target?.dispose();
    entry.target = new three.WebGLRenderTarget(w, h, options);
    entry.key = key;
    return entry.target;
  };
  return {
    /** A full-screen GLSL 3 material; `fragment` may use xtree `#include`s resolved against `chunks`. */
    material(
      fragment: string,
      uniforms: Record<string, { value: unknown }>,
      ...chunks: Parameters<typeof include>[1][]
    ): RawShaderMaterial {
      const material = new three.RawShaderMaterial({
        glslVersion: three.GLSL3,
        vertexShader: fullscreenVertex,
        fragmentShader: chunks.length ? include(fragment, ...chunks) : fragment,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
      materials.push(material);
      return material;
    },
    /** A half-float, linearly filtered target at `scale` of the pass size. */
    target(scale = 1): KitTarget {
      const entry = {
        scale,
        target: null as WebGLRenderTarget | null,
        key: '',
      };
      targets.push(entry);
      return {
        get target() {
          return ensure(entry);
        },
        get texture() {
          return ensure(entry).texture;
        },
        get width() {
          return ensure(entry).width;
        },
        get height() {
          return ensure(entry).height;
        },
        setScale(next: number) {
          entry.scale = next;
        },
      };
    },
    /** Draws a full-screen triangle with `material` into a kit target (or a plain target). */
    draw(
      renderer: WebGLRenderer,
      material: Material,
      target: KitTarget | WebGLRenderTarget | null,
    ): void {
      draw(
        renderer,
        material,
        target && 'setScale' in target ? target.target : target,
      );
    },
    /** Resizes every kit target on its next use. */
    setSize(w: number, h: number): void {
      width = w;
      height = h;
    },
    /** Releases every material and target the kit made. */
    dispose(): void {
      for (const material of materials) material.dispose();
      for (const entry of targets) entry.target?.dispose();
    },
  };
}

/** The helpers `createPassKit` returns. */
export type PassKit = ReturnType<typeof createPassKit>;
