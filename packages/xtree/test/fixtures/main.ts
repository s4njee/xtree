/// <reference types="vite/client" />
// GPU fixture page. Tests call window.xt to render effect stacks into a fixed
// 320x180 canvas and read the pixels back.
import { createStudio } from '@xtree/scenes';
import { blendModes } from '../../src/shaders/blend/constants.js';
import { analyseFlashes, type FlashFrame } from '../../src/safety/index.js';
import {
  fontCharacters,
  fontTexels,
  tileHeight,
  tileWidth,
} from '../../src/effects/ascii/font.js';
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
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  TorusKnotGeometry,
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
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
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
  /**
   * `studio` (the docs demo scene) or `card`: a test card with an image, a
   * gradient ramp and bitmap text behind a lit 3D model (X18.3).
   */
  scene?: 'studio' | 'card';
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

/**
 * The test card's backdrop, 640×360 sRGB, computed per pixel so it is the
 * same in every browser: a landscape "photo" (left), a gray ramp and a hue
 * ramp (top right) and text in the ASCII effect's bitmap font (bottom right).
 */
function cardImage(): DataTexture {
  const w = 640;
  const h = 360;
  const data = new Uint8Array(w * h * 4);
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const mix = (a: number[], b: number[], t: number) =>
    a.map((v, i) => v + (b[i]! - v) * t);
  const hue = (t: number) =>
    [0, 2, 4].map(
      (k) => 255 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (t - k / 6))),
    );
  // Rows from the top (y = 0); the texture is flipped when written.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let rgb: number[];
      if (x < 320) {
        const sky = mix([40, 70, 160], [250, 170, 120], y / 200);
        const sun = 1 - smooth(28, 31, Math.hypot(x - 210, y - 110));
        const hill = 230 + 30 * Math.sin(x / 37) + 12 * Math.sin(x / 11);
        const far = 205 + 22 * Math.sin(x / 23 + 1.3);
        rgb = mix(sky, [255, 236, 170], sun);
        rgb = mix(rgb, [70, 90, 120], smooth(far - 1, far + 1, y));
        rgb = mix(rgb, [40, 110, 60], smooth(hill - 1, hill + 1, y));
        // A striped field, for fine detail.
        if (y > hill + 20 && Math.floor(x / 6 + y / 9) % 2 === 0)
          rgb = mix(rgb, [210, 190, 80], 0.6);
      } else if (y < 60) rgb = Array(3).fill(((x - 320) / 319) * 255);
      else if (y < 120) rgb = hue((x - 320) / 320);
      else if (y < 250) rgb = [18, 20, 28];
      else rgb = [236, 232, 220];
      data.set([...rgb.map(Math.round), 255], ((h - 1 - y) * w + x) * 4);
    }
  // Text: rows of glyphs at 2× and 3×, light on dark and dark on light.
  const font = fontTexels();
  const stripWidth = tileWidth * fontCharacters.length;
  const write = (
    text: string,
    left: number,
    top: number,
    scale: number,
    ink: number[],
  ) =>
    [...text].forEach((char, n) => {
      const index = fontCharacters.indexOf(char);
      for (let ty = 0; ty < tileHeight; ty++)
        for (let tx = 0; tx < tileWidth; tx++) {
          const texel =
            ((tileHeight - 1 - ty) * stripWidth + index * tileWidth + tx) * 4;
          if (!font[texel]) continue;
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++) {
              const x = left + (n * tileWidth + tx) * scale + sx;
              const y = top + ty * scale + sy;
              if (x < w && y < h) data.set(ink, ((h - 1 - y) * w + x) * 4);
            }
        }
    });
  write('10:01 +-=*#%@', 334, 134, 3, [240, 240, 240, 255]);
  write('0110 1001 .:-=+*#', 334, 170, 2, [124, 196, 255, 255]);
  write('@%#*+=-:. 01', 334, 196, 2, [255, 209, 102, 255]);
  write('1010 #@# 0101', 334, 268, 3, [20, 22, 30, 255]);
  write('.:-=+*#%@ 10', 334, 306, 2, [200, 40, 60, 255]);
  const texture = new DataTexture(data, w, h, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  update(time: number): void;
}
let cardStage: Stage | null = null;
/** The test card scene, created on first use. */
function card(): Stage {
  if (cardStage) return cardStage;
  const scene = new Scene();
  scene.background = new Color('#101218');
  const camera = new PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  // The backdrop fills the view at z = -1.
  const tall = 2 * 7 * Math.tan((19 * Math.PI) / 180);
  const backdrop = new Mesh(
    new PlaneGeometry((tall * width) / height, tall),
    new MeshBasicMaterial({ map: cardImage() }),
  );
  backdrop.position.z = -1;
  backdrop.name = 'backdrop';
  const knot = new Mesh(
    new TorusKnotGeometry(0.55, 0.19, 160, 24),
    new MeshStandardMaterial({
      color: '#6b7cff',
      roughness: 0.32,
      metalness: 0.35,
    }),
  );
  knot.position.set(0.2, 0.15, 1.5);
  knot.rotation.set(0.4, 0.6, 0);
  knot.name = 'knot';
  const sun = new DirectionalLight(0xffffff, 2.6);
  sun.position.set(3, 5, 4);
  scene.add(new HemisphereLight(0xbcd2ff, 0x1a1a2a, 1.4), sun, backdrop, knot);
  cardStage = { scene, camera, update() {} };
  return cardStage;
}

/** The scene the current render uses. */
let stage: Stage = studio;

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
        const object = stage.scene.getObjectByName(name);
        if (!object) throw new Error(`no object named ${name}`);
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
  stage = spec.scene === 'card' ? card() : studio;
  stage.update(0);
  const composer = new EffectComposer(renderer, { merge: spec.merge ?? true });
  composer.setScene(stage.scene, stage.camera);
  const effects = createEffects(spec.effects, spec.sharedMask);
  // Material effects patch studio materials for this render only.
  const patched: [Material, MaterialEffect][] = [];
  effects.forEach((effect, i) => {
    if (!(effect instanceof MaterialEffect)) return;
    effect.time = spec.time ?? 0;
    effect.setMotion(spec.motion ?? true);
    const names = spec.effects![i]!.targets ??
      (stage === studio ? effect.definition.meta.demo?.selection : null) ?? [
        'knot',
      ];
    for (const name of names) {
      const mesh = stage.scene.getObjectByName(name) as Mesh | undefined;
      if (!mesh) throw new Error(`no object named ${name}`);
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
    stage = studio;
  }
}

const xt = {
  factories: Object.keys(factories),
  kind(id: string) {
    return factories[id]?.definition.kind ?? 'post';
  },
  /** Whether an effect animates (declares freeze or settle). */
  animated(id: string) {
    const motion = factories[id]?.definition.motion ?? 'static';
    return motion !== 'static';
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
  /** Renders `frames` frames 0.5 s apart while playing with motion off; reports whether any frame changed. */
  motionOff(spec: RenderSpec, frames = 4) {
    return withComposer({ ...spec, motion: false }, (composer, effects) => {
      composer.play();
      composer.render(0);
      const first = readPixels();
      let changed = 0;
      for (let i = 0; i < frames; i++) {
        for (const effect of effects)
          if (effect instanceof MaterialEffect) effect.tick(0.5);
        composer.render(0.5);
        const pixels = readPixels();
        if (pixels.some((v, j) => v !== first[j])) changed++;
      }
      return { changed, time: composer.time };
    });
  },
  /** Renders `seconds` of an animated stack at `fps` and runs the photosensitivity analyser on it. */
  flashCheck(spec: RenderSpec, seconds = 2, fps = 30) {
    return withComposer(spec, (composer, effects) => {
      composer.play();
      const frames: FlashFrame[] = [];
      for (let i = 0; i < seconds * fps; i++) {
        for (const effect of effects)
          if (effect instanceof MaterialEffect) effect.tick(1 / fps);
        studio.update(i / fps);
        composer.render(i === 0 ? 0 : 1 / fps);
        frames.push({ width, height, pixels: readPixels() });
      }
      studio.update(0);
      const { flashFrames, ...report } = analyseFlashes(frames, { fps });
      return { ...report, flashes: flashFrames.length };
    });
  },
  /** The composer clock: time while paused, after play, and with autoplay. */
  clock() {
    configure({});
    const run = (options: { autoplay?: boolean }, play: boolean) => {
      const composer = new EffectComposer(renderer, options);
      composer.setScene(studio.scene, studio.camera);
      if (play) composer.play();
      composer.render(0.25);
      composer.render(0.25);
      const time = composer.time;
      composer.dispose();
      return time;
    };
    return {
      paused: run({}, false),
      played: run({}, true),
      autoplay: run({ autoplay: true }, false),
    };
  },
  /** Renders a probe effect that writes xt_progress, xt_pointer and xt_scroll, and reads the middle pixel. */
  inputs(values: {
    progress?: number;
    pointer?: [number, number];
    scroll?: number;
    drive?: number;
  }) {
    configure({ toneMapping: 'none', colorSpace: 'linear' });
    const probe = defineEffect({
      name: 'inputs-probe',
      meta: {
        title: 'Inputs',
        family: 'utility',
        story: 'X1.10',
        description: 'Probe.',
      },
      params: {},
      fragment:
        'vec4 $main(vec4 color, vec2 uv) { return vec4(xt_progress, xt_pointer.x, xt_pointer.y, 1.0) * (1.0 - xt_scroll * 0.5); }',
    });
    const composer = new EffectComposer(renderer);
    composer.setScene(studio.scene, studio.camera);
    composer.add(probe());
    if (values.progress !== undefined) composer.progress = values.progress;
    if (values.pointer) composer.inputs.pointer = values.pointer;
    if (values.scroll !== undefined) composer.inputs.scroll = values.scroll;
    let stop = () => {};
    if (values.drive !== undefined) {
      let listener: (v: number) => void = () => {};
      stop = composer.drive({
        value: 0,
        subscribe(cb) {
          listener = cb;
          return () => {
            listener = () => {};
          };
        },
      });
      listener(values.drive);
    }
    composer.render(0);
    const pixels = readPixels();
    stop();
    composer.dispose();
    const i = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
    return pixels.slice(i, i + 4);
  },
  /** Pass descriptions and timings after a few frames with timing on. */
  inspect() {
    return withComposer(
      { effects: [{ id: 'bloom' }, { id: 'vignette' }, { id: 'outline' }] },
      (composer) => {
        composer.timing = true;
        for (let i = 0; i < 6; i++) composer.render(0);
        return {
          passes: composer.describe().map(({ source, ...rest }) => ({
            ...rest,
            sourceLength: source.length,
          })),
          timings: composer.timings,
        };
      },
    );
  },
  /** Every blend mode applied to a gradient map over the studio, tiled into one image (X1.8). */
  blendGrid() {
    const modes = Object.keys(blendModes);
    const columns = 6;
    const tileW = 160;
    const tileH = 90;
    const grid = document.createElement('canvas');
    grid.width = columns * tileW;
    grid.height = Math.ceil(modes.length / columns) * tileH;
    const g = grid.getContext('2d')!;
    modes.forEach((mode, i) => {
      withComposer(
        {
          effects: [{ id: 'gradient-map', blend: mode, opacity: 0.8 }],
        },
        (composer) => {
          composer.render(0);
          g.drawImage(
            canvas,
            (i % columns) * tileW,
            Math.floor(i / columns) * tileH,
            tileW,
            tileH,
          );
        },
      );
    });
    return { png: grid.toDataURL('image/png'), modes: modes.length };
  },
  /** The xtree and HoloCSS motion policies for a set of DOM cases, under the page's emulated media. */
  async motionPolicies() {
    const ours = await import('../../src/motion/index.js');
    const theirs = await import('@holocss/runtime');
    const host = document.createElement('div');
    document.body.append(host);
    host.innerHTML = `
      <div data-case="plain"><span></span></div>
      <div data-hcss-motion="none" data-case="motion-none"><span></span></div>
      <div data-hcss-motion="full" data-case="motion-full"><span></span></div>
      <div data-hcss-theme="high-contrast" data-case="high-contrast"><span></span></div>
      <div data-hcss-theme="auto" data-case="auto"><span></span></div>
      <div data-hcss-theme="dark" data-case="dark"><span></span></div>
      <div data-hcss-theme="auto"><div data-hcss-motion="none" data-case="auto-none"><span></span></div></div>`;
    const rows = [
      ...host.querySelectorAll<HTMLElement>('[data-case] > span'),
    ].map((el) => ({
      case: el.parentElement!.dataset.case!,
      xtree: ours.motionAllowed(el),
      holocss: theirs.motionAllowed(el),
    }));
    host.remove();
    return rows;
  },
  /**
   * The HoloCSS round trip (X15.2, X15.3): HoloCSS's real tokens and runtime,
   * every built-in theme applied in turn to an ancestor, and what the bound
   * effects, a transition accent and a composer's motion follow.
   */
  async holocssRoundTrip() {
    const [{ default: tokens }, { builtinThemes }, holo] = await Promise.all([
      import('@holocss-src/components/tokens.css?inline'),
      import('@holocss-src/theme/registry'),
      import('../../src/holocss/index.js'),
    ]);
    const style = document.createElement('style');
    style.textContent = tokens;
    document.head.append(style);
    const host = document.createElement('div');
    const probe = document.createElement('span');
    host.append(probe);
    document.body.append(host);
    const ids = ['outline', 'depth-fog', 'gradient-map', 'holographic-foil'];
    const effects = createEffects(ids.map((id) => ({ id })));
    let accent = '';
    const player = { setAccent: (hex: string) => (accent = hex) };
    const composer = new EffectComposer(renderer);
    const unbindTheme = holo.bindTheme([...effects, player], probe);
    const unbindMotion = holo.bindMotion(composer, probe);
    const settle = () => new Promise((r) => setTimeout(r, 0));
    const colors = (effect: Effect) =>
      Object.fromEntries(
        Object.entries(effect.definition.params)
          .filter(([, p]) => p.kind === 'color')
          .map(([name]) => [name, effect.get(name as never) as string]),
      );
    const themes = [];
    try {
      for (const theme of builtinThemes.filter((t) => t !== 'auto')) {
        host.dataset.hcssTheme = theme;
        await settle();
        const css = getComputedStyle(probe);
        themes.push({
          theme,
          tokens: Object.fromEntries(
            ['accent', 'background', 'surface', 'text'].map((role) => [
              role,
              css.getPropertyValue(`--hcss-${role}`).trim(),
            ]),
          ),
          resolved: holo.resolveTheme(probe),
          effects: Object.fromEntries(
            ids.map((id, i) => [id, colors(effects[i]!)]),
          ),
          accent,
          motion: composer.motion,
        });
      }
      host.dataset.hcssTheme = 'dark';
      host.dataset.hcssMotion = 'none';
      await settle();
      const motionNone = composer.motion;
      delete host.dataset.hcssMotion;
      await settle();
      const motionRestored = composer.motion;
      unbindTheme();
      host.dataset.hcssTheme = 'light';
      await settle();
      const afterUnbind = colors(effects[0]!);
      return {
        themes,
        motionNone,
        motionRestored,
        afterUnbind,
        roles: Object.fromEntries(
          ids.map((id, i) => [
            id,
            Object.fromEntries(
              Object.entries(effects[i]!.definition.params)
                .filter(([, p]) => p.kind === 'color')
                .map(([name, p]) => [name, (p as { theme?: string }).theme]),
            ),
          ]),
        ),
      };
    } finally {
      unbindTheme();
      unbindMotion();
      composer.dispose();
      for (const effect of effects) effect.dispose();
      host.remove();
      style.remove();
    }
  },
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
  lifecycle(options: { cycles?: number; everyEffect?: boolean } = {}) {
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
    // The nightly run (X18.4) also cycles every effect on its own, in turn.
    const singles = options.everyEffect
      ? Object.keys(factories).filter((id) => xt.kind(id) !== 'transition')
      : [];
    const transitions = options.everyEffect
      ? Object.keys(factories).filter((id) => xt.kind(id) === 'transition')
      : [];
    let turn = 0;
    const cycle = () => {
      let last = memory();
      const extra: RenderSpec[] = singles.length
        ? [{ effects: [{ id: singles[turn % singles.length]! }] }]
        : [];
      for (const stack of [...stacks, ...extra])
        last = withComposer(stack, (composer) => {
          composer.render(0);
          return memory();
        });
      if (transitions.length) {
        const factory = factories[
          transitions[turn % transitions.length]!
        ] as unknown as () => Transition;
        const transition = factory();
        const player = createTransition(renderer, transition, {
          from: transitionImages.from,
          to: transitionImages.to,
        });
        player.progress = 0.5;
        player.render();
        last = memory();
        player.dispose();
        transition.dispose();
      }
      turn++;
      return last;
    };
    // Warm up once: rendering the scene into a buffer compiles the studio's own
    // materials in a second variant, which three.js keeps with those materials.
    // A full rotation covers every material effect's variant of each studio
    // material, which three.js keeps with the material until it is disposed.
    for (let i = 0; i < Math.max(1, singles.length); i++) cycle();
    configure({});
    renderer.render(studio.scene, studio.camera);
    const before = memory();
    let during = before;
    for (let i = 0; i < (options.cycles ?? 20); i++) during = cycle();
    renderer.render(studio.scene, studio.camera);
    return { before, during, after: memory() };
  },
  /** The composer's stack, option and error APIs, with a three.js pass in the stack (X18.1). */
  async composerApi() {
    configure({});
    const log: Record<string, unknown> = {};
    const composer = new EffectComposer(renderer);
    const error = (run: () => void) => {
      try {
        run();
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    };
    log.noScene = error(() => composer.render(0));
    composer.setScene(studio.scene, studio.camera);
    const [vignette, mono, aberration, fog, outline, glow] = createEffects([
      { id: 'vignette' },
      { id: 'monochrome' },
      { id: 'chromatic-aberration' },
      { id: 'depth-fog' },
      { id: 'buffer-view', params: { buffer: 'normal' } },
      { id: 'glow', mask: { selection: ['box'] } },
    ]);
    composer.add(vignette!, mono!).add(aberration!);
    log.effects = composer.effects.map((e) => e.name);
    log.duplicate = error(() => composer.add(vignette!));
    composer.remove(mono!);
    log.afterRemove = composer.items.length;
    // A three.js pass between effects: an invert ShaderPass.
    const invert = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader:
        'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(1.0 - c.rgb, c.a); }',
    });
    composer.setItems([vignette!, invert, aberration!]);
    composer.render(0);
    const inverted = readPixels();
    log.describe = composer.describe().map((p) => ({
      label: p.label,
      effects: p.effects,
      compiles: p.compiles,
    }));
    log.passes = composer.passes.length;
    invert.enabled = false;
    composer.render(0);
    log.passesDisabled = composer.passes.length;
    const plain = readPixels();
    log.invertChanged = inverted.some((v, i) => i % 4 !== 3 && v !== plain[i]);
    composer.remove(invert);
    // Merging off: every effect gets its own pass.
    composer.setItems([vignette!, mono!]);
    composer.merge = false;
    composer.render(0);
    log.unmerged = { merge: composer.merge, passes: composer.passes.length };
    composer.merge = true;
    composer.render(0);
    log.merged = composer.passes.length;
    composer.dithering = true;
    composer.render(0);
    log.dithering = composer.dithering;
    composer.dithering = false;
    // Clock.
    log.playing = [
      composer.playing,
      composer.play().playing,
      composer.pause().playing,
    ];
    composer.progress = Number.NaN;
    log.progressNaN = composer.progress;
    composer.progress = 2;
    log.progressHigh = composer.progress;
    let listener: ((value: number) => void) | null = null;
    const stop = composer.drive({
      value: 0.25,
      subscribe(callback) {
        listener = callback;
        return () => (listener = null);
      },
    });
    log.driveInitial = composer.progress;
    (listener as ((value: number) => void) | null)?.(0.75);
    log.driveUpdate = composer.progress;
    stop();
    log.driveStopped = listener === null;
    // Timing reports null where the GPU has no timer queries.
    composer.timing = true;
    composer.render(0);
    composer.render(0);
    log.timing = {
      on: composer.timing,
      timings: composer.timings === null ? null : 'object',
      gpuMs: composer.describe()[0]?.gpuMs ?? null,
    };
    composer.timing = false;
    log.timingOff = composer.timings;
    log.bufferSize = composer.bufferSize;
    // Buffers and prepasses come and go with the effects that need them.
    composer.setItems([fog!, outline!, glow!]);
    composer.render(0);
    log.withBuffers = { ...composer.stats };
    composer.setItems([vignette!]);
    composer.render(0);
    log.withoutBuffers = { ...composer.stats };
    composer.dispose();
    composer.dispose();
    log.afterDispose = error(() => composer.render(0));
    for (const effect of [mono, aberration, fog, outline, glow])
      effect!.dispose();
    invert.dispose();
    return log;
  },
  /** Pointer, scroll and audio tracking into composer inputs (X1.11). */
  async interaction() {
    const { trackPointer, trackScroll, trackAudio } =
      await import('../../src/core/index.js');
    const target = {
      inputs: {
        pointer: [0.5, 0.5] as [number, number],
        pointerVelocity: [0, 0] as [number, number],
        scroll: 0,
        audio: [0, 0, 0, 0] as [number, number, number, number],
      },
    };
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const rect = canvas.getBoundingClientRect();
    const move = (u: number, v: number) =>
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: rect.left + u * rect.width,
          clientY: rect.top + (1 - v) * rect.height,
        }),
      );
    const stopPointer = trackPointer(target, canvas);
    move(0.25, 0.75);
    const pointer = [...target.inputs.pointer];
    await wait(30);
    move(0.5, 0.75);
    const velocity = [...target.inputs.pointerVelocity];
    await wait(150);
    const settled = [...target.inputs.pointerVelocity];
    stopPointer();
    move(0.9, 0.1);
    const afterStop = [...target.inputs.pointer];
    // Scroll: the page, then an element passing through the viewport.
    const spacer = document.createElement('div');
    spacer.style.height = `${window.innerHeight * 3}px`;
    document.body.append(spacer);
    const stopPage = trackScroll(target);
    window.scrollTo(
      0,
      (document.documentElement.scrollHeight - innerHeight) / 2,
    );
    window.dispatchEvent(new Event('scroll'));
    const pageScroll = target.inputs.scroll;
    stopPage();
    const stopElement = trackScroll(target, spacer);
    window.dispatchEvent(new Event('scroll'));
    const elementScroll = target.inputs.scroll;
    stopElement();
    window.scrollTo(0, 0);
    spacer.remove();
    // Audio: a 110 Hz tone into an analyser.
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 110;
    const analyser = context.createAnalyser();
    oscillator.connect(analyser);
    oscillator.start();
    const stopAudio = trackAudio(target, analyser);
    window.dispatchEvent(new KeyboardEvent('keydown'));
    await context.resume().catch(() => {});
    await wait(300);
    const audio = [...target.inputs.audio];
    stopAudio();
    const audioStopped = [...target.inputs.audio];
    oscillator.stop();
    await context.close();
    return {
      pointer,
      velocity,
      settled,
      afterStop,
      pageScroll,
      elementScroll,
      audio,
      audioState: context.state,
      audioStopped,
    };
  },
  /** The debug overlay over a rendering composer (X1.14). */
  async debugOverlay() {
    const { createDebugOverlay } = await import('../../src/core/index.js');
    configure({});
    const composer = new EffectComposer(renderer);
    composer.setScene(studio.scene, studio.camera);
    composer.setItems(createEffects([{ id: 'bloom' }, { id: 'vignette' }]));
    const host = document.createElement('div');
    document.body.append(host);
    const overlay = createDebugOverlay(composer, host);
    const timingOn = composer.timing;
    const start = performance.now();
    while (performance.now() - start < 600) {
      composer.render(1 / 60);
      await new Promise((r) => requestAnimationFrame(r));
    }
    const text = overlay.element.textContent ?? '';
    const source = overlay.shaderSource(0);
    const missing = overlay.shaderSource(99);
    overlay.dispose();
    const removed = !host.contains(overlay.element);
    host.remove();
    const timingAfter = composer.timing;
    composer.dispose();
    return {
      text,
      timingOn,
      timingAfter,
      source: source.includes('void main'),
      missing,
      removed,
    };
  },
  /** Transition player textures, material patch errors and prepasses across a resize. */
  async edgeCases() {
    const { materialEffects } = await import('../../src/core/index.js');
    const error = (run: () => void) => {
      try {
        run();
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    };
    // Transition player textures can be swapped.
    const transition = (factories.crossfade as unknown as () => Transition)();
    const player = createTransition(renderer, transition, {
      from: transitionImages.from,
      to: transitionImages.to,
    });
    player.from = transitionImages.to;
    player.to = transitionImages.from;
    const swapped =
      player.from === transitionImages.to &&
      player.to === transitionImages.from;
    player.dispose();
    transition.dispose();
    // Material patching rejects unsupported materials and double patches.
    const [hologram] = createEffects([{ id: 'hologram' }]) as MaterialEffect[];
    const shader = new ShaderMaterial();
    const unsupported = error(() => patchMaterial(shader, hologram!));
    const standard = new MeshStandardMaterial();
    patchMaterial(standard, hologram!);
    const listed = materialEffects(standard).map((e) => e.name);
    const twice = error(() => patchMaterial(standard, hologram!));
    unpatchMaterial(standard, hologram!);
    const afterUnpatch = materialEffects(standard).length;
    const unknown = materialEffects(shader).length;
    hologram!.dispose();
    standard.dispose();
    shader.dispose();
    // Prepasses follow a resize, and objects that can't be drawn into them
    // (a sprite) are hidden there and shown again afterwards.
    const { Sprite, SpriteMaterial } = await import('three');
    const sprite = new Sprite(new SpriteMaterial({ color: 0xff00ff }));
    studio.scene.add(sprite);
    const sizes = withComposer(
      {
        effects: [
          { id: 'outline' },
          { id: 'glow', mask: { selection: ['box'] } },
        ],
      },
      (composer) => {
        composer.render(0);
        renderer.setSize(200, 100);
        composer.render(0);
        const resized = { ...composer.bufferSize };
        renderer.setSize(width, height);
        composer.render(0);
        return { resized, restored: { ...composer.bufferSize } };
      },
    );
    const spriteVisible = sprite.visible;
    studio.scene.remove(sprite);
    sprite.material.dispose();
    return {
      swapped,
      unsupported,
      listed,
      twice,
      afterUnpatch,
      unknown,
      sizes,
      spriteVisible,
    };
  },
  /** GpuTimer against a stand-in timer extension, since software GL has none. */
  async gpuTimer() {
    const { GpuTimer } = await import('../../src/core/index.js');
    let nextQuery = 1;
    let current = 0;
    const results = new Map<number, number>();
    let available = false;
    let disjoint = false;
    const deleted: number[] = [];
    const ext = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
    const gl = {
      QUERY_RESULT_AVAILABLE: 0x8867,
      QUERY_RESULT: 0x8866,
      getExtension: () => ext,
      createQuery: () => (current = nextQuery++),
      beginQuery() {},
      endQuery() {},
      getParameter: () => disjoint,
      getQueryParameter: (query: number, name: number) =>
        name === 0x8867 ? available : (results.get(query) ?? 0),
      deleteQuery: (query: number) => deleted.push(query),
    } as unknown as WebGL2RenderingContext;
    const timer = new GpuTimer(gl);
    const frame = (ms: number[]) => {
      ms.forEach((value, i) =>
        timer.measure(`span ${i}`, () => results.set(current, value * 1e6)),
      );
      timer.endFrame();
    };
    let nested = 0;
    timer.measure('outer', () => timer.measure('inner', () => nested++));
    timer.endFrame();
    frame([1, 2]);
    const pending = { ...timer.latest };
    available = true;
    frame([3, 4]);
    const ready = { ...timer.latest };
    available = false;
    for (let i = 0; i < 8; i++) frame([5]);
    const capped = deleted.length;
    disjoint = true;
    frame([6]);
    const afterDisjoint = { ...timer.latest };
    timer.dispose();
    const unsupported = new GpuTimer({
      getExtension: () => null,
    } as unknown as WebGL2RenderingContext);
    let ran = 0;
    unsupported.measure('x', () => ran++);
    unsupported.endFrame();
    return {
      supported: timer.supported,
      nested,
      pending,
      ready,
      capped,
      afterDisjoint,
      deleted: deleted.length,
      unsupported: { supported: unsupported.supported, ran },
    };
  },
  /** Names of the programs three.js currently holds (for debugging leaks). */
  programNames() {
    return (renderer.info.programs ?? []).map(
      (p) => `${p.name || p.cacheKey.slice(0, 120)} x${p.usedTimes}`,
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
