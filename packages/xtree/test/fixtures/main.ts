/// <reference types="vite/client" />
// GPU fixture page. Tests call window.xt to render effect stacks into a fixed
// 320x180 canvas and read the pixels back.
import { createStudio } from '@xtree/scenes';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
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
import { EffectComposer, EffectPass } from '../../src/core/index.js';
import { defineEffect, type Effect } from '../../src/effect/index.js';
import { createSampleTexture } from '../../src/core/index.js';
import type { EffectFactory, ParamSchema } from '../../src/effect/index.js';

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
}

export interface RenderSpec {
  effects?: EffectSpec[];
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

function createEffects(specs: EffectSpec[] = []): Effect[] {
  return specs.map((spec) => {
    const factory = factories[spec.id] as unknown as
      ((options: Record<string, unknown>) => Effect) | undefined;
    if (!factory) throw new Error(`unknown effect ${spec.id}`);
    return factory({
      ...(spec.preset ? { preset: spec.preset } : {}),
      ...(spec.params ?? {}),
      ...(spec.blend ? { blend: spec.blend } : {}),
      ...(spec.opacity !== undefined ? { opacity: spec.opacity } : {}),
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
  const effects = createEffects(spec.effects);
  composer.setItems(effects);
  composer.time = spec.time ?? 0;
  composer.motion = spec.motion ?? true;
  try {
    return run(composer, effects);
  } finally {
    composer.dispose();
  }
}

const xt = {
  factories: Object.keys(factories),
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
  lifecycle() {
    const memory = () => ({
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      programs: renderer.info.programs?.length ?? 0,
    });
    const cycle = () =>
      withComposer(
        {
          effects: [
            { id: 'bloom' },
            { id: 'chromatic-aberration', params: { samples: 6 } },
            { id: 'vignette' },
            { id: 'rgb-split-glitch' },
            { id: 'holographic-foil' },
          ],
        },
        (composer) => {
          composer.render(0);
          return memory();
        },
      );
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
