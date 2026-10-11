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
  Matrix4,
  MeshBasicMaterial,
  MeshNormalMaterial,
  NearestFilter,
  ShaderMaterial,
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

const velocityVertex = /* glsl */ `
uniform mat4 xtPreviousModel;
uniform mat4 xtPreviousViewProjection;
varying vec4 vCurrent;
varying vec4 vPrevious;
void main() {
  vCurrent = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vPrevious = xtPreviousViewProjection * xtPreviousModel * vec4(position, 1.0);
  gl_Position = vCurrent;
}`;

const velocityFragment = /* glsl */ `
varying vec4 vCurrent;
varying vec4 vPrevious;
void main() {
  // Clip space to UV: half the difference of the normalized device coordinates.
  vec2 velocity = (vCurrent.xy / vCurrent.w - vPrevious.xy / vPrevious.w) * 0.5;
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

/**
 * Screen-space motion for the `velocity` buffer: where each visible point
 * was in the previous frame (its object's previous world matrix and the
 * camera's previous view and projection), as a UV offset in red and green.
 * The first frame, and objects seen for the first time, have no motion.
 * Skinned and morphing geometry and instances move as their object does.
 */
export class VelocityPrepass {
  readonly target: WebGLRenderTarget;
  /** One material per face side; per-object matrices are set as each object draws. */
  readonly #materials = new Map<Side, ShaderMaterial>();
  #previous = new Map<Object3D, Matrix4>();
  #previousViewProjection: Matrix4 | null = null;
  readonly #viewProjection = new Matrix4();

  constructor(width: number, height: number) {
    this.target = new WebGLRenderTarget(width, height, {
      type: HalfFloatType,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    });
    this.target.texture.name = 'xtree:velocity';
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
  }

  #material(side: Side): ShaderMaterial {
    let material = this.#materials.get(side);
    if (material) return material;
    material = new ShaderMaterial({
      vertexShader: velocityVertex,
      fragmentShader: velocityFragment,
      uniforms: {
        xtPreviousModel: { value: new Matrix4() },
        xtPreviousViewProjection: { value: new Matrix4() },
      },
      side,
    });
    const previousModel = (object: Object3D) => this.#previous.get(object);
    const viewProjection = () =>
      this.#previousViewProjection ?? this.#viewProjection;
    // The material is shared, so each object's previous matrix is set as it draws.
    material.onBeforeRender = (
      _renderer,
      _scene,
      _camera,
      _geometry,
      object,
    ) => {
      const uniforms = material!.uniforms;
      (uniforms.xtPreviousModel!.value as Matrix4).copy(
        previousModel(object) ?? object.matrixWorld,
      );
      (uniforms.xtPreviousViewProjection!.value as Matrix4).copy(
        viewProjection(),
      );
      material!.uniformsNeedUpdate = true;
    };
    this.#materials.set(side, material);
    return material;
  }

  render(renderer: WebGLRenderer, root: Object3D, camera: Camera): void {
    camera.updateMatrixWorld();
    this.#viewProjection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    const drawn: Object3D[] = [];
    renderReplaced(renderer, root, camera, this.target, (object) => {
      drawn.push(object);
      const original = object.material as Material | Material[];
      return this.#material(
        (Array.isArray(original) ? original[0]?.side : original.side) ??
          FrontSide,
      );
    });
    // Remember this frame for the next one; forget objects no longer drawn.
    const next = new Map<Object3D, Matrix4>();
    for (const object of drawn)
      next.set(
        object,
        (this.#previous.get(object) ?? new Matrix4()).copy(object.matrixWorld),
      );
    this.#previous = next;
    this.#previousViewProjection = (
      this.#previousViewProjection ?? new Matrix4()
    ).copy(this.#viewProjection);
  }

  /** Forgets the previous frame, so the next render reports no motion (after a cut or a resize). */
  reset(): void {
    this.#previous.clear();
    this.#previousViewProjection = null;
  }

  dispose(): void {
    this.target.dispose();
    for (const material of this.#materials.values()) material.dispose();
    this.#previous.clear();
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
