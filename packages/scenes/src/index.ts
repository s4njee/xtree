import {
  BoxGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TorusKnotGeometry,
} from 'three';

export interface SampleScene {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Poses the animated parts at `seconds`. The pose at 0 is the reference frame for tests. */
  update(seconds: number): void;
  /** Updates the camera for a new aspect ratio. */
  resize(aspect: number): void;
  dispose(): void;
}

function checkerTexture(): DataTexture {
  const size = 8;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = (x + y) % 2 === 0 ? 46 : 26;
      data.set([v, v, v + 6, 255], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.needsUpdate = true;
  return texture;
}

/**
 * A small studio: a lit torus knot, a glowing HDR orb and ring for bloom, a
 * checker floor with hard edges for lens and glitch effects, and saturated
 * shapes for color effects. Fully deterministic for a given `update` time.
 */
export function createStudio(aspect = 16 / 9): SampleScene {
  const scene = new Scene();
  scene.background = new Color('#0b0d14');
  const camera = new PerspectiveCamera(38, aspect, 0.1, 100);
  camera.position.set(0, 1.7, 7);
  camera.lookAt(0, 0.7, 0);

  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(resource: T): T => {
    disposables.push(resource);
    return resource;
  };

  scene.add(new HemisphereLight(0xbcd2ff, 0x1a1a2a, 1.4));
  const sun = new DirectionalLight(0xffffff, 2.6);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const floor = new Mesh(
    own(new PlaneGeometry(40, 40)),
    own(
      new MeshStandardMaterial({
        map: own(checkerTexture()),
        roughness: 0.85,
        metalness: 0,
      }),
    ),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const knot = new Mesh(
    own(new TorusKnotGeometry(0.75, 0.26, 160, 24)),
    own(
      new MeshStandardMaterial({
        color: '#6b7cff',
        roughness: 0.32,
        metalness: 0.35,
      }),
    ),
  );
  knot.position.set(0, 1.25, 0);
  scene.add(knot);

  const orb = new Mesh(
    own(new SphereGeometry(0.42, 48, 24)),
    own(
      new MeshStandardMaterial({
        color: '#000000',
        emissive: '#ff7a3d',
        emissiveIntensity: 7,
      }),
    ),
  );
  orb.position.set(-2.1, 0.75, 0.4);
  scene.add(orb);

  const box = new Mesh(
    own(new BoxGeometry(0.9, 0.9, 0.9)),
    own(new MeshStandardMaterial({ color: '#3ddc97', roughness: 0.5 })),
  );
  box.position.set(2.1, 0.45, 0.3);
  box.rotation.y = 0.6;
  scene.add(box);

  const gem = new Mesh(
    own(new IcosahedronGeometry(0.32, 0)),
    own(
      new MeshStandardMaterial({
        color: '#ff4fa3',
        roughness: 0.25,
        metalness: 0.1,
        flatShading: true,
      }),
    ),
  );
  gem.position.set(2.1, 1.25, 0.3);
  scene.add(gem);

  const ring = new Mesh(
    own(new TorusGeometry(2.6, 0.035, 12, 160)),
    own(
      new MeshStandardMaterial({
        color: '#000000',
        emissive: '#5ad8ff',
        emissiveIntensity: 5,
      }),
    ),
  );
  ring.position.set(0, 1.25, -2.2);
  scene.add(ring);

  const update = (seconds: number) => {
    knot.rotation.set(0.35, seconds * 0.4, 0);
    gem.rotation.set(seconds * 0.7, seconds * 0.5, 0);
    ring.rotation.set(0, 0, seconds * 0.2);
  };
  update(0);

  return {
    scene,
    camera,
    update,
    resize(nextAspect) {
      camera.aspect = nextAspect;
      camera.updateProjectionMatrix();
    },
    dispose() {
      for (const resource of disposables) resource.dispose();
    },
  };
}
