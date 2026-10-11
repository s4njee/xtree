/**
 * Hover previews for the gallery (X19.17): hovering a card with a fine
 * pointer plays its effect live on the studio scene, in a small canvas over
 * the still. One renderer serves the whole gallery and is created on the
 * first hover. Nothing plays when motion is off (the OS setting or the
 * site's motion switch), and transitions keep their still.
 */
import type { Material, Mesh } from 'three';
import { effectLoaders } from './effect-registry';

interface Runtime {
  canvas: HTMLCanvasElement;
  render(delta: number): void;
  show(id: string, kind: string): Promise<boolean>;
  clear(): void;
}

let runtime: Promise<Runtime | null> | null = null;

async function createRuntime(): Promise<Runtime | null> {
  if (!document.createElement('canvas').getContext('webgl2')) return null;
  const [three, core, scenes] = await Promise.all([
    import('three'),
    import('@mk7s/xtree/core'),
    import('@xtree/scenes'),
  ]);
  const renderer = new three.WebGLRenderer({ antialias: false });
  renderer.toneMapping = three.ACESFilmicToneMapping;
  renderer.setPixelRatio(1);
  renderer.setSize(320, 180, false);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  const studio = scenes.createStudio(16 / 9);
  const composer = new core.EffectComposer(renderer);
  composer.setScene(studio.scene, studio.camera);
  composer.play();
  const knot = studio.scene.getObjectByName('knot') as
    (Mesh & { material: Material }) | undefined;
  let current: { dispose(): void } | null = null;
  let patched = false;
  let time = 0;
  const clear = () => {
    composer.setItems([]);
    if (patched && knot) core.unpatchMaterial(knot.material);
    patched = false;
    current?.dispose();
    current = null;
  };
  return {
    canvas,
    clear,
    render(delta) {
      time += delta;
      studio.update(time);
      composer.render(delta);
    },
    async show(id, kind) {
      clear();
      const factory = await effectLoaders[id]?.();
      if (!factory) return false;
      const effect = (factory as unknown as () => { dispose(): void })();
      current = effect;
      if (kind === 'material') {
        if (!knot) return false;
        core.patchMaterial(knot.material, effect as never);
        patched = true;
      } else composer.setItems([effect as never]);
      time = 0;
      return true;
    },
  };
}

/** Starts a preview in `host` (the card's media box); returns a function that stops it. */
export async function startPreview(
  host: HTMLElement,
  id: string,
  kind: string,
): Promise<() => void> {
  const { motionAllowed } = await import('@mk7s/xtree/motion');
  if (kind === 'transition' || !motionAllowed(host)) return () => {};
  runtime ??= createRuntime();
  const live = await runtime;
  if (!live || !(await live.show(id, kind))) return () => {};
  host.append(live.canvas);
  host.dataset.previewing = '';
  let frame = 0;
  let last = performance.now();
  const loop = (now: number) => {
    // About 30 frames a second is plenty for a thumbnail.
    if (now - last >= 30) {
      live.render(Math.min(0.1, (now - last) / 1000));
      last = now;
    }
    frame = requestAnimationFrame(loop);
  };
  live.render(0);
  frame = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(frame);
    delete host.dataset.previewing;
    live.canvas.remove();
    live.clear();
  };
}
