/**
 * Prepasses for geometry buffers and selection masks. Each one re-renders
 * the scene with replacement materials, so it only runs when an enabled
 * effect needs it.
 */
import {
  Color,
  DoubleSide,
  FrontSide,
  HalfFloatType,
  MeshBasicMaterial,
  MeshNormalMaterial,
  WebGLRenderTarget,
} from 'three';
import type { Camera, Material, Object3D, Side, WebGLRenderer } from 'three';
import type { SelectionMask } from '../effect/mask.js';

type Renderable = Object3D & {
  material?: Material | Material[];
  isMesh?: boolean;
  isLine?: boolean;
  isPoints?: boolean;
  isSprite?: boolean;
};

const black = new Color(0, 0, 0);

/**
 * Renders `root` into `target` with every mesh, line and point cloud drawn
 * with `pick(object)` and anything else that has a material (sprites) hidden,
 * on a transparent black background. Materials, visibility, the background
 * and the clear color are restored afterwards.
 */
export function renderReplaced(
  renderer: WebGLRenderer,
  root: Object3D,
  camera: Camera,
  target: WebGLRenderTarget,
  pick: (object: Renderable) => Material,
): void {
  const materials = new Map<Renderable, Material | Material[]>();
  const hidden: Renderable[] = [];
  root.traverse((object: Renderable) => {
    if (!object.material) return;
    if (!(object.isMesh || object.isLine || object.isPoints)) {
      if (object.visible) hidden.push(object);
      object.visible = false;
      return;
    }
    materials.set(object, object.material);
    object.material = pick(object);
  });
  const scene = root as Object3D & { isScene?: boolean; background?: unknown };
  const background = scene.isScene ? scene.background : undefined;
  if (scene.isScene) scene.background = null;
  const clearColor = renderer.getClearColor(new Color());
  const clearAlpha = renderer.getClearAlpha();
  const previous = renderer.getRenderTarget();
  try {
    renderer.setClearColor(black, 0);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(root, camera);
  } finally {
    renderer.setRenderTarget(previous);
    renderer.setClearColor(clearColor, clearAlpha);
    if (scene.isScene) scene.background = background;
    for (const [object, material] of materials) object.material = material;
    for (const object of hidden) object.visible = true;
  }
}

/** View-space normals for the `normal` buffer. */
export class NormalPrepass {
  readonly target: WebGLRenderTarget;
  /** One material per face side, so double-sided objects keep their back faces. */
  readonly #materials = new Map<Side, MeshNormalMaterial>();

  constructor(width: number, height: number, samples = 0) {
    this.target = new WebGLRenderTarget(width, height, {
      type: HalfFloatType,
      samples,
    });
    this.target.texture.name = 'xtree:normal';
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
  }

  render(renderer: WebGLRenderer, root: Object3D, camera: Camera): void {
    renderReplaced(renderer, root, camera, this.target, (object) => {
      const original = object.material as Material | Material[];
      const side =
        (Array.isArray(original) ? original[0]?.side : original.side) ??
        FrontSide;
      let material = this.#materials.get(side);
      if (!material)
        this.#materials.set(
          side,
          (material = new MeshNormalMaterial({ side })),
        );
      return material;
    });
  }

  dispose(): void {
    this.target.dispose();
    for (const material of this.#materials.values()) material.dispose();
  }
}

/** White where selected objects are visible, black elsewhere. */
export class SelectionPrepass {
  readonly target: WebGLRenderTarget;
  readonly #selected = new MeshBasicMaterial({
    color: 0xffffff,
    side: DoubleSide,
  });
  readonly #occluder = new MeshBasicMaterial({
    color: 0x000000,
    side: DoubleSide,
  });
  /** X-ray: unselected objects neither draw nor hide anything. */
  readonly #ignored = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
  });

  constructor(width: number, height: number, samples = 0) {
    this.target = new WebGLRenderTarget(width, height, { samples });
    this.target.texture.name = 'xtree:selection';
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
  }

  render(
    renderer: WebGLRenderer,
    root: Object3D,
    camera: Camera,
    mask: SelectionMask,
  ): void {
    const { selection, xray = false } = mask;
    let isSelected: (object: Object3D) => boolean;
    if (Array.isArray(selection)) {
      const set = new Set<Object3D>();
      for (const object of selection as readonly Object3D[])
        object.traverse((child) => set.add(child));
      isSelected = (object) => set.has(object);
    } else {
      const { layer } = selection as { layer: number };
      isSelected = (object) => object.layers.isEnabled(layer);
    }
    renderReplaced(renderer, root, camera, this.target, (object) =>
      isSelected(object)
        ? this.#selected
        : xray
          ? this.#ignored
          : this.#occluder,
    );
  }

  dispose(): void {
    this.target.dispose();
    this.#selected.dispose();
    this.#occluder.dispose();
    this.#ignored.dispose();
  }
}
