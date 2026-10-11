import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  OrthographicCamera,
  Scene,
} from 'three';
import type { Material, WebGLRenderer, WebGLRenderTarget } from 'three';

/** Draws materials over a full-screen triangle. */
export class Fullscreen {
  readonly #scene = new Scene();
  readonly #camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly #geometry = new BufferGeometry();
  readonly #mesh: Mesh;

  constructor() {
    this.#geometry.setAttribute(
      'position',
      new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    this.#mesh = new Mesh(this.#geometry);
    this.#mesh.frustumCulled = false;
    this.#scene.add(this.#mesh);
  }

  /** Draws a full-screen triangle with `material` into `target` (the canvas when null). */
  draw(
    renderer: WebGLRenderer,
    material: Material,
    target: WebGLRenderTarget | null,
  ): void {
    this.#mesh.material = material;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.render(this.#scene, this.#camera);
    renderer.setRenderTarget(previous);
  }

  /** Releases the triangle's geometry. */
  dispose(): void {
    this.#geometry.dispose();
  }
}
