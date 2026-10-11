/// <reference types="vite/client" />
// GPU fixture page. Tests call window.xt to render effect stacks into a fixed
// 320x180 canvas and read the pixels back.
import { createStudio } from '@xtree/scenes';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  DataTexture,
  LinearFilter,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshMatcapMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  SphereGeometry,
  Color,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  RGBAFormat,
  FloatType,
  WebGLRenderTarget,
  LinearSRGBColorSpace,
  LinearToneMapping,
  NeutralToneMapping,
  NoToneMapping,
  ReinhardToneMapping,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { EffectComposer as ThreeEffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import {
  createTransition,
  toHoloEffect,
  EffectComposer,
  EffectPass,
  patchMaterial,
  unpatchMaterial,
} from '../../src/core/index.js';
import {
  defineEffect,
  MaterialEffect,
  type Effect,
} from '../../src/effect/index.js';
import { createSampleTexture } from '../../src/core/index.js';
import type {
  EffectFactory,
  ParamSchema,
  Transition,
} from '../../src/effect/index.js';

// Every effect folder, discovered at build time.
const modules = import.meta.glob<Record<string, unknown>>(
  '../../src/effects/*/index.ts',
  { eager: true },
);
export const factories: Record<
  string,
  EffectFactory<ParamSchema>
> = Object.fromEntries(
  Object.values(modules).flatMap((module) =>
    Object.values(module)
      .filter(
        (value): value is EffectFactory<ParamSchema> =>
          typeof value === 'function' && 'definition' in value,
      )
      .map((factory) => [factory.definition.name, factory]),
  ),
);

export interface EffectSpec {
  id: string;
  preset?: string;
  params?: Record<string, unknown>;
  blend?: string;
  opacity?: number;
  /**
   * A mask: studio objects by name, a depth range, a left-to-right gradient
   * texture, or `demo` for the effect's `meta.demo.selection` (if any).
   */
  mask?: MaskSpec | 'demo' | 'shared';
  enabled?: boolean;
  /** Material effects: studio objects to patch (default: the effect's demo selection, or the knot). */
  targets?: string[];
}

export type MaskSpec =
  | { selection: string[]; xray?: boolean; invert?: boolean }
  | { layer: number; xray?: boolean; invert?: boolean }
  | { depth: [number, number]; feather?: number; invert?: boolean }
  | { texture: 'gradient'; channel?: 'r' | 'g' | 'b' | 'a'; invert?: boolean };

export interface RenderSpec {
  effects?: EffectSpec[];
  /** One mask object shared by every effect whose mask is `shared`. */
  sharedMask?: MaskSpec;
  /** Clear to black instead of the studio's background color. */
  noBackground?: boolean;
  merge?: boolean;
  toneMapping?: keyof typeof toneMappings;
  colorSpace?: 'srgb' | 'linear';
  time?: number;
  motion?: boolean;
}

const toneMappings = {
  none: NoToneMapping,
  linear: LinearToneMapping,
  reinhard: ReinhardToneMapping,
  cineon: CineonToneMapping,
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
  neutral: NeutralToneMapping,
};

const width = 320;
const height = 180;
const canvas = document.createElement('canvas');
document.body.append(canvas);
const renderer = new WebGLRenderer({
  canvas,
  antialias: false,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(1);
renderer.setSize(width, height);
const studio = createStudio(width / height);

const studioBackground = studio.scene.background;

function configure(spec: RenderSpec) {
  studio.scene.background = spec.noBackground ? null : studioBackground;
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = toneMappings[spec.toneMapping ?? 'aces'];
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace =
    spec.colorSpace === 'linear' ? LinearSRGBColorSpace : SRGBColorSpace;
}

// A horizontal ramp from 0 (left) to 1 (right) in every channel.
const gradient = (() => {
  const data = new Uint8Array(256 * 4);
  for (let x = 0; x < 256; x++) data.fill(x, x * 4, x * 4 + 4);
  const texture = new DataTexture(data, 256, 1, RGBAFormat);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
})();

function toMask(
  spec: EffectSpec | { mask?: MaskSpec },
  factory?: EffectFactory<ParamSchema>,
) {
  let mask = spec.mask;
  if (mask === 'shared')
    throw new Error('shared masks are resolved by createEffects');
  if (mask === 'demo') {
    const selection = factory?.definition.meta.demo?.selection;
    if (!selection) return undefined;
    mask = { selection: [...selection] };
  }
  if (!mask) return undefined;
  if ('selection' in mask) {
    return {
      ...mask,
      selection: mask.selection.map((name) => {
        const object = studio.scene.getObjectByName(name);
        if (!object) throw new Error(`no studio object named ${name}`);
        return object;
      }),
    };
  }
  if ('layer' in mask) {
    const { layer, ...rest } = mask;
    return { ...rest, selection: { layer } };
  }
  if ('texture' in mask) return { ...mask, texture: gradient };
  return mask;
}

/** Two deterministic sRGB images for transitions: warm rings and cool stripes. */
function transitionImage(kind: 'from' | 'to'): DataTexture {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (kind === 'from') {
        const r = Math.hypot(x - width * 0.35, y - height * 0.5);
        const ring = Math.floor(r / 14) % 2;
        data.set([220 - ring * 60, 120 + (x / width) * 80, 60, 255], i);
      } else {
        const stripe = Math.floor((x + y) / 16) % 2;
        data.set([40, 90 + stripe * 70, 200 - (y / height) * 80, 255], i);
      }
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
const transitionImages = {
  from: transitionImage('from'),
  to: transitionImage('to'),
};

export interface TransitionSpec {
  id: string;
  preset?: string;
  params?: Record<string, unknown>;
  progress: number;
  /** `holocss` renders the way HoloCSS's transition3d() does, through toHoloEffect(). */
  via?: 'xtree' | 'holocss';
}

// transition3d()'s vertex shader and plane, from HoloCSS src/three/transition.ts.
const holoVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

function renderTransition(spec: TransitionSpec) {
  configure({});
  const factory = factories[spec.id] as unknown as (
    options: Record<string, unknown>,
  ) => Transition;
  const transition = factory({
    ...(spec.preset ? { preset: spec.preset } : {}),
    ...(spec.params ?? {}),
  });
  const accent = '#7cc4ff';
  try {
    if (spec.via === 'holocss') {
      const effect = toHoloEffect(transition);
      const material = new ShaderMaterial({
        vertexShader: holoVertex,
        fragmentShader: effect.fragment,
        uniforms: {
          fromTexture: { value: transitionImages.from },
          toTexture: { value: transitionImages.to },
          progress: { value: spec.progress },
          accent: { value: new Color(accent) },
        },
        transparent: true,
        depthTest: false,
      });
      const geometry = new PlaneGeometry(2, 2, 64, 32);
      const scene = new Scene();
      scene.add(new Mesh(geometry, material));
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
      camera.position.z = 2;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      const result = snapshot();
      material.dispose();
      geometry.dispose();
      return { ...result, fallback: effect.fallback, name: effect.name };
    }
    const player = createTransition(renderer, transition, {
      from: transitionImages.from,
      to: transitionImages.to,
      accent,
    });
    player.progress = spec.progress;
    player.render();
    const result = snapshot();
    player.dispose();
    return { ...result, fallback: '', name: transition.definition.meta.title };
  } finally {
    transition.dispose();
  }
}

function createEffects(
  specs: EffectSpec[] = [],
  sharedMask?: MaskSpec,
): Effect[] {
  const shared = sharedMask ? toMask({ mask: sharedMask }) : undefined;
  return specs.map((spec) => {
    const factory = factories[spec.id] as unknown as
      ((options: Record<string, unknown>) => Effect) | undefined;
    if (!factory) throw new Error(`unknown effect ${spec.id}`);
    return factory({
      ...(spec.preset ? { preset: spec.preset } : {}),
      ...(spec.params ?? {}),
      ...(spec.blend ? { blend: spec.blend } : {}),
      ...(spec.opacity !== undefined ? { opacity: spec.opacity } : {}),
      ...(spec.enabled !== undefined ? { enabled: spec.enabled } : {}),
      mask:
        (spec.mask === 'shared' ? shared : toMask(spec, factories[spec.id]!)) ??
        null,
    });
  });
}

/** Reads the canvas as RGBA8 rows from top to bottom. */
function readPixels(): number[] {
  const gl = renderer.getContext();
  const data = new Uint8Array(width * height * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
  const rows = new Uint8Array(data.length);
  for (let y = 0; y < height; y++)
    rows.set(
      data.subarray((height - 1 - y) * width * 4, (height - y) * width * 4),
      y * width * 4,
    );
  return Array.from(rows);
}

function snapshot() {
  return {
    png: canvas.toDataURL('image/png'),
    pixels: readPixels(),
    width,
    height,
  };
}

function withComposer<T>(
  spec: RenderSpec,
  run: (composer: EffectComposer, effects: Effect[]) => T,
): T {
  configure(spec);
  studio.update(0);
  const composer = new EffectComposer(renderer, { merge: spec.merge ?? true });
  composer.setScene(studio.scene, studio.camera);
  const effects = createEffects(spec.effects, spec.sharedMask);
  // Material effects patch studio materials for this render only.
  const patched: [Material, MaterialEffect][] = [];
  effects.forEach((effect, i) => {
    if (!(effect instanceof MaterialEffect)) return;
    effect.time = spec.time ?? 0;
    effect.setMotion(spec.motion ?? true);
    const names = spec.effects![i]!.targets ??
      effect.definition.meta.demo?.selection ?? ['knot'];
    for (const name of names) {
      const mesh = studio.scene.getObjectByName(name) as Mesh | undefined;
      if (!mesh) throw new Error(`no studio object named ${name}`);
      const material = mesh.material as Material;
      patchMaterial(material, effect);
      patched.push([material, effect]);
    }
  });
  composer.setItems(effects.filter((e) => !(e instanceof MaterialEffect)));
  composer.time = spec.time ?? 0;
  composer.motion = spec.motion ?? true;
  try {
    return run(composer, effects);
  } finally {
    for (const [material, effect] of patched) unpatchMaterial(material, effect);
    for (const effect of effects)
      if (effect instanceof MaterialEffect) effect.dispose();
    composer.dispose();
  }
}

const xt = {
  factories: Object.keys(factories),
  kind(id: string) {
    return factories[id]?.definition.kind ?? 'post';
  },
  renderTransition,
  /**
   * Runs a transition through HoloCSS's own transition3d() between two solid
   * colors, stops it at `progress` and reads the middle pixel of its stage.
   */
  async holoTransition(spec: Omit<TransitionSpec, 'via'>) {
    const { transition3d } = await import('@holocss/three');
    const target = document.createElement('div');
    target.style.cssText =
      'position:fixed;left:0;top:0;width:160px;height:90px;';
    document.body.append(target);
    const source = (color: string) => {
      const canvas = new OffscreenCanvas(160, 90);
      const g = canvas.getContext('2d')!;
      g.fillStyle = color;
      g.fillRect(0, 0, 160, 90);
      return canvas;
    };
    const errors: string[] = [];
    const log = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' ').slice(0, 300));
    };
    let updates = 0;
    let driven = false;
    let pixel: number[] = [];
    const factory = factories[spec.id] as unknown as (
      options: Record<string, unknown>,
    ) => Transition;
    const transition = factory({
      ...(spec.preset ? { preset: spec.preset } : {}),
      ...(spec.params ?? {}),
    });
    try {
      const result = await transition3d(
        source('rgb(200, 120, 60)'),
        source('rgb(40, 90, 200)'),
        toHoloEffect(transition),
        {
          target,
          update: () => {
            updates++;
          },
          driver(control) {
            driven = true;
            control.progress = spec.progress;
            // The stage is a 2D canvas that HoloCSS copies each WebGL frame into.
            const canvas = document.querySelector<HTMLCanvasElement>(
              'canvas[data-hcss-three]',
            );
            const g = canvas?.getContext('2d');
            if (canvas && g)
              pixel = [
                ...g.getImageData(
                  Math.floor(canvas.width / 2),
                  Math.floor(canvas.height / 2),
                  1,
                  1,
                ).data,
              ];
            control.finish();
          },
        },
      );
      return { status: result.status, updates, pixel, errors, driven };
    } finally {
      console.error = log;
      target.remove();
      transition.dispose();
    }
  },
  /** The two transition test images as display pixels (rows top to bottom). */
  transitionImages() {
    return withComposer({}, () => {
      const out = {} as { from: number[]; to: number[] };
      for (const name of ['from', 'to'] as const) {
        const texture = transitionImages[name];
        const player = createTransition(
          renderer,
          (factories.crossfade as unknown as () => Transition)(),
          { from: texture, to: texture },
        );
        player.render();
        out[name] = readPixels();
        player.dispose();
      }
      return out;
    });
  },
  presets(id: string) {
    return Object.keys(factories[id]?.definition.presets ?? {});
  },
  /** Renders a stack with the xtree composer. */
  render(spec: RenderSpec) {
    return withComposer(spec, (composer) => {
      composer.render(0);
      return {
        ...snapshot(),
        passes: composer.passes.length,
        compiles: composer.stats.compiles,
        prepasses: composer.stats.prepasses,
        depth: composer.stats.depth,
      };
    });
  },
  /** Renders a stack into a float target and returns the display-encoded floats (RGBA, rows bottom to top). */
  renderFloat(spec: RenderSpec) {
    return withComposer(spec, (composer) => {
      const target = new WebGLRenderTarget(width, height, {
        type: FloatType,
        depthBuffer: false,
      });
      composer.render(0, target);
      const data = new Float32Array(width * height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, data);
      target.dispose();
      return { pixels: Array.from(data), passes: composer.passes.length };
    });
  },
  /** Renders an effect whose texture parameter is a texture built from `lut` data (for checking LUT layout). */
  renderLutData(spec: RenderSpec & { size: number; data: number[] }) {
    const texture = createSampleTexture({
      kind: 'data3d',
      size: spec.size,
      data: new Float32Array(spec.data),
    });
    try {
      return withComposer(
        {
          ...spec,
          effects: [{ id: 'lut', params: { lut: texture as never } }],
        },
        (composer) => {
          composer.render(0);
          return snapshot();
        },
      );
    } finally {
      texture.dispose();
    }
  },
  /** Renders the scene straight to the canvas, without a composer. */
  renderPlain(spec: RenderSpec) {
    configure(spec);
    studio.update(0);
    renderer.setRenderTarget(null);
    renderer.render(studio.scene, studio.camera);
    return snapshot();
  },
  /** Renders effects in three.js's own EffectComposer: RenderPass, one EffectPass per group, OutputPass. */
  renderThreeComposer(spec: RenderSpec & { groups: EffectSpec[][] }) {
    configure(spec);
    studio.update(0);
    const composer = new ThreeEffectComposer(renderer);
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(studio.scene, studio.camera));
    const groups = spec.groups.map((group) => createEffects(group));
    const passes = groups.map((effects) => new EffectPass(effects));
    for (const pass of passes) composer.addPass(pass as never);
    composer.addPass(new OutputPass());
    composer.render(0);
    const result = snapshot();
    for (const pass of passes) pass.dispose();
    for (const effect of groups.flat()) effect.dispose();
    composer.dispose();
    return result;
  },
  /** Renders a stack at two times and reports whether the frames differ. */
  motionPair(spec: RenderSpec & { times: [number, number] }) {
    return withComposer(spec, (composer) => {
      composer.time = spec.times[0];
      composer.render(0);
      const first = readPixels();
      composer.time = spec.times[1];
      composer.render(0);
      const second = readPixels();
      return { first, second };
    });
  },
  /** Checks which changes recompile: a float, then a structural parameter. */
  recompiles() {
    return withComposer(
      {
        effects: [
          { id: 'bloom' },
          { id: 'vignette' },
          { id: 'chromatic-aberration' },
        ],
      },
      (composer, effects) => {
        composer.render(0);
        const programs = () => renderer.info.programs?.length ?? 0;
        const start = {
          compiles: composer.stats.compiles,
          programs: programs(),
        };
        const [, vig, ca] = effects as [
          Effect,
          Effect & { darkness: number },
          Effect & { samples: number },
        ];
        vig.darkness = 0.9;
        composer.render(0);
        const afterFloat = {
          compiles: composer.stats.compiles,
          programs: programs(),
        };
        ca.samples = 8;
        composer.render(0);
        const afterStructural = {
          compiles: composer.stats.compiles,
          programs: programs(),
        };
        const passCompiles = composer.passes.map(
          (p) => (p as EffectPass).compiles,
        );
        return {
          start,
          afterFloat,
          afterStructural,
          passCompiles,
          passes: composer.passes.length,
        };
      },
    );
  },
  /** Counts GPU resources before, during and after a composer's life. */
  /**
   * Patches fresnel glow into a sphere with each supported material type and
   * reports whether the glow changed the image, with any shader errors.
   */
  materialTypes() {
    const types = {
      MeshBasicMaterial,
      MeshLambertMaterial,
      MeshPhongMaterial,
      MeshStandardMaterial,
      MeshPhysicalMaterial,
      MeshToonMaterial,
      MeshMatcapMaterial,
    };
    const errors: string[] = [];
    const log = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' ').slice(0, 300));
    };
    try {
      return Object.entries(types).map(([name, Type]) => {
        const material = new Type({ color: '#335' });
        const mesh = new Mesh(new SphereGeometry(0.6, 32, 16), material);
        mesh.position.set(0, 1.25, 1.5);
        studio.scene.add(mesh);
        const plain = withComposer({}, (composer) => {
          composer.render(0);
          return readPixels();
        });
        const glow = factories['fresnel-glow']!() as unknown as MaterialEffect;
        patchMaterial(material, glow);
        const patched = withComposer({}, (composer) => {
          composer.render(0);
          return readPixels();
        });
        unpatchMaterial(material, glow);
        const restored = withComposer({}, (composer) => {
          composer.render(0);
          return readPixels();
        });
        studio.scene.remove(mesh);
        mesh.geometry.dispose();
        material.dispose();
        glow.dispose();
        const differing = (a: number[], b: number[]) =>
          a.filter((v, i) => Math.abs(v - b[i]!) > 8).length;
        return {
          name,
          changed: differing(plain, patched),
          restored: differing(plain, restored),
          errors: [...errors.splice(0)],
        };
      });
    } finally {
      console.error = log;
    }
  },
  /** Program counts around float and structural changes to a patched material effect. */
  materialRecompiles() {
    const knot = studio.scene.getObjectByName('knot') as Mesh;
    const material = knot.material as Material;
    const film = factories['thin-film']!() as unknown as MaterialEffect & {
      intensity: number;
      variation: string;
    };
    const programs = () => renderer.info.programs?.length ?? 0;
    const frame = () =>
      withComposer({}, (composer) => {
        composer.render(0);
      });
    patchMaterial(material, film);
    frame();
    const start = programs();
    film.intensity = 0.3;
    frame();
    const afterFloat = programs();
    const version = material.version;
    film.set({ variation: 'height' } as never);
    const flagged = material.version > version;
    frame();
    const afterStructural = programs();
    unpatchMaterial(material, film);
    film.dispose();
    frame();
    return { start, afterFloat, flagged, afterStructural };
  },
  lifecycle() {
    const memory = () => ({
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      programs: renderer.info.programs?.length ?? 0,
    });
    const stacks: RenderSpec[] = [
      {
        effects: [
          { id: 'bloom' },
          { id: 'chromatic-aberration', params: { samples: 6 } },
          { id: 'vignette' },
          { id: 'rgb-split-glitch' },
          { id: 'holographic-foil' },
        ],
      },
      // Material effects patched into studio materials and removed again.
      {
        effects: [
          { id: 'hologram' },
          { id: 'dissolve', targets: ['box'] },
          { id: 'thin-film', targets: ['box'] },
        ],
      },
      // Geometry buffers and selection prepasses, including x-ray.
      {
        effects: [
          { id: 'depth-fog' },
          { id: 'outline' },
          { id: 'glow', mask: { selection: ['box'] } },
          { id: 'selective-bloom', mask: { selection: ['knot'], xray: true } },
        ],
      },
    ];
    const cycle = () => {
      let last = memory();
      for (const stack of stacks)
        last = withComposer(stack, (composer) => {
          composer.render(0);
          return memory();
        });
      return last;
    };
    // Warm up once: rendering the scene into a buffer compiles the studio's own
    // materials in a second variant, which three.js keeps with those materials.
    cycle();
    configure({});
    renderer.render(studio.scene, studio.camera);
    const before = memory();
    let during = before;
    for (let i = 0; i < 20; i++) during = cycle();
    renderer.render(studio.scene, studio.camera);
    return { before, during, after: memory() };
  },
  /** Names of the programs three.js currently holds (for debugging leaks). */
  programNames() {
    return (renderer.info.programs ?? []).map(
      (p) => `${p.name} x${p.usedTimes}`,
    );
  },
  /** Resizes the canvas between renders and counts buffer allocations. */
  resize() {
    return withComposer({ effects: [{ id: 'vignette' }] }, (composer) => {
      composer.render(0);
      const first = composer.stats.allocations;
      renderer.setSize(200, 100);
      composer.render(0);
      composer.render(0);
      const size = composer.bufferSize;
      const afterResize = composer.stats.allocations - first;
      renderer.setSize(width, height);
      composer.render(0);
      return { first, afterResize, size, final: composer.stats.allocations };
    });
  },
  /** Renders an effect whose shader does not compile and returns what the composer logged. */
  brokenShader() {
    const broken = defineEffect({
      name: 'broken-fixture',
      meta: {
        title: 'Broken',
        family: 'color',
        story: 'X0.0',
        description: 'Fails to compile on purpose.',
      },
      params: {},
      fragment:
        'vec4 $main(vec4 color, vec2 uv) {\n  return color * $missing;\n}\n',
    });
    const logged: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) =>
      logged.push(args.map(String).join(' '));
    try {
      configure({});
      const composer = new EffectComposer(renderer);
      composer.setScene(studio.scene, studio.camera);
      composer.add(broken());
      composer.render(0);
      composer.dispose();
    } finally {
      console.error = original;
    }
    return logged;
  },
  /** Loses and restores the WebGL context around renders. */
  async contextLoss() {
    const extension = renderer.getContext().getExtension('WEBGL_lose_context');
    if (!extension) return { supported: false };
    const composer = new EffectComposer(renderer);
    composer.setScene(studio.scene, studio.camera);
    composer.setItems(createEffects([{ id: 'bloom' }, { id: 'vignette' }]));
    configure({});
    composer.render(0);
    const lost = new Promise((resolve) =>
      canvas.addEventListener('webglcontextlost', resolve, { once: true }),
    );
    extension.loseContext();
    await lost;
    // Restoring is only allowed once the lost event has finished dispatching.
    await new Promise((resolve) => setTimeout(resolve, 0));
    composer.render(0);
    const restored = new Promise((resolve) =>
      canvas.addEventListener('webglcontextrestored', resolve, { once: true }),
    );
    extension.restoreContext();
    await restored;
    composer.render(0);
    const pixels = readPixels();
    composer.dispose();
    const lit = pixels.filter((v, i) => i % 4 !== 3 && v > 0).length;
    return { supported: true, lit };
  },
};

declare global {
  interface Window {
    xt: typeof xt;
  }
}
window.xt = xt;
document.body.dataset.ready = 'true';
