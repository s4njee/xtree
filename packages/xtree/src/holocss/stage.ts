import type { Camera, Object3D, WebGLRenderer } from 'three';
import { motionAllowed, watchMotion } from '@mk7s/holocss/runtime';
import { bindMotion } from '../motion/index.js';

/**
 * The parts of a HoloCSS `Stage` (`@mk7s/holocss/three`) that xtree uses,
 * described structurally so this module doesn't import HoloCSS's three.js
 * entry.
 */
export interface HoloStage {
  /** The stage's 2D presentation canvas. */
  readonly canvas: HTMLCanvasElement;
  /** The document's shared WebGL renderer (pixel ratio 1). */
  readonly renderer: WebGLRenderer;
  /** True once the stage is destroyed or the shared context is lost. */
  readonly lost: boolean;
  /** Disposes `resource` when the stage is destroyed. */
  own<
    T extends {
      /** Releases the resource. */
      dispose(): void;
    },
  >(
    resource: T,
  ): T;
  /** Renders `scene` into the stage's canvas; false once the stage is gone. */
  render(scene: Object3D, camera: Camera): boolean;
}

/** What `stageEffects` needs from a composer; an xtree `EffectComposer` fits. */
export interface StageComposer {
  /** Sets the scene and camera it renders. */
  setScene(scene: Object3D, camera: Camera): unknown;
  /** Renders a frame `delta` seconds after the last one, to the screen. */
  render(delta?: number): void;
  /** Releases its GPU resources. */
  dispose(): void;
  /** Whether its effects animate. */
  motion: boolean;
  /** Starts its clock. */
  play(): unknown;
}

/**
 * Renders a HoloCSS stage through an xtree composer (X15.4): on the stage's
 * shared renderer, so there is no second WebGL context, into the stage's
 * canvas at its device-pixel size. The stage owns the composer, so
 * destroying the stage (or losing the context) disposes it and its effects'
 * GPU resources. The composer follows HoloCSS's motion policy for the stage
 * and starts playing when motion is allowed.
 *
 * Returns a `render(scene, camera)` that replaces `stage.render`; like it,
 * it returns false once the stage is gone.
 *
 * ```ts
 * const stage = await createStage(element, { placement: 'inside' });
 * const composer = new EffectComposer(stage.renderer).add(bloom(), filmGrain());
 * const render = stageEffects(stage, composer);
 * render(scene, camera);
 * ```
 */
export function stageEffects(
  stage: HoloStage,
  composer: StageComposer,
): (scene: Object3D, camera: Camera) => boolean {
  const unbind = bindMotion(composer, stage.canvas, {
    motionAllowed,
    watchMotion,
  });
  stage.own({
    dispose() {
      unbind();
      composer.dispose();
    },
  });
  if (composer.motion) composer.play();
  const surface = stage.canvas.getContext('2d');
  let last = -1;
  return (scene, camera) => {
    if (stage.lost || !surface) return false;
    const { renderer, canvas } = stage;
    // As stage.render does: the shared renderer draws at the stage's pixel size, then the frame is copied to its canvas.
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.setClearColor(0, 0);
    const now = globalThis.performance?.now() ?? Date.now();
    const delta = last < 0 ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    composer.setScene(scene, camera);
    composer.render(delta);
    surface.clearRect(0, 0, canvas.width, canvas.height);
    surface.drawImage(renderer.domElement, 0, 0);
    return true;
  };
}

/** The context HoloCSS's `scene()` passes to a scene builder. */
export interface HoloSceneContext {
  readonly stage: HoloStage;
}

/** What a HoloCSS scene builder returns: at least its camera. */
export interface HoloSceneView {
  readonly camera: Camera;
}

/** A HoloCSS ambient scene builder, such as `gradient`, `particles` or `litObject`. */
export type HoloSceneBuilder<
  C extends HoloSceneContext,
  V extends HoloSceneView,
> = (context: C) => V;

/**
 * Wraps a HoloCSS ambient scene builder so the scene renders through xtree
 * effects (X15.5). `create` makes the composer on the stage's shared
 * renderer; everything else about the scene, including its theme colors,
 * motion handling and lifetime, stays HoloCSS's.
 *
 * ```ts
 * import { scene } from '@mk7s/holocss/three';
 * import { gradient } from '@mk7s/holocss/three/scenes/gradient';
 *
 * await scene(hero, withEffects(gradient, (renderer) =>
 *   new EffectComposer(renderer).add(bloom(), filmGrain(), holographicFoil())));
 * ```
 */
export function withEffects<
  C extends HoloSceneContext,
  V extends HoloSceneView,
>(
  build: HoloSceneBuilder<C, V>,
  create: (renderer: WebGLRenderer) => StageComposer,
): HoloSceneBuilder<C, V> {
  return (context) => {
    const view = build(context);
    const render = stageEffects(context.stage, create(context.stage.renderer));
    // scene() draws through the stage it passed to the builder.
    (context.stage as { render: HoloStage['render'] }).render = render;
    return view;
  };
}
