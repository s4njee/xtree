import { createPassKit, defineEffect, float, int } from '../../effect/index.js';
import { noiseValueChunks, samplingPyramidChunks } from '../../shaders/maps.js';
import brightSource from './bright.glsl';
import fragment from './composite.glsl';
import ghostSource from './ghosts.glsl';
import kawaseSource from './kawase.glsl';

/** Screen-space lens flare: ghosts, a halo, a starburst and lens dirt from the bright spots in the frame. */
export const lensFlare = defineEffect({
  name: 'lens-flare',
  meta: {
    title: 'Lens flare',
    family: 'lens',
    story: 'X4.6',
    description:
      'Ghost reflections and a halo mirrored through the frame center from every bright spot, with color fringes, a starburst and lens dirt, as light bounces inside a camera lens.',
    related: ['anamorphic', 'bloom', 'lens-dirt'],
  },
  sampling: 'input',
  chunks: [noiseValueChunks],
  params: {
    intensity: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Brightness of the flare.',
    }),
    threshold: float({
      default: 1.5,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Linear brightness above which light flares.',
    }),
    ghosts: int({
      default: 5,
      min: 1,
      max: 8,
      step: 1,
      description: 'Number of ghost reflections.',
    }),
    spacing: float({
      default: 0.35,
      min: 0.05,
      max: 1,
      step: 0.01,
      description: 'Distance between ghosts along the line through the center.',
    }),
    halo: float({
      default: 0.6,
      min: 0,
      max: 2,
      step: 0.05,
      description: 'Brightness of the ring around the center.',
    }),
    haloWidth: float({
      default: 0.45,
      min: 0.1,
      max: 0.8,
      step: 0.01,
      description: 'Radius of the ring.',
    }),
    chromatic: float({
      default: 0.006,
      min: 0,
      max: 0.03,
      step: 0.001,
      description: 'Color fringing of the ghosts.',
    }),
    starburst: float({
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Rays radiating from the center over the flare.',
    }),
    dirtAmount: float({
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Smudges and specks on the lens that light up in the flare.',
    }),
  },
  presets: {
    cinematic: { intensity: 1.2, ghosts: 6, halo: 0.8, starburst: 0.6 },
    subtle: { intensity: 0.5, ghosts: 3, halo: 0.3, dirtAmount: 0.1 },
    dirty: { dirtAmount: 0.9, intensity: 1.4 },
    rainbow: { chromatic: 0.02, ghosts: 8, spacing: 0.25 },
  },
  textures: ['flare'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect, three } = context;
    const vector = () => new three.Vector2();
    const bright = kit.material(brightSource, {
      source: { value: null },
      texel: { value: vector() },
      threshold: effect.uniforms.threshold!,
    });
    const ghost = kit.material(ghostSource, {
      bright: { value: null },
      ghosts: effect.uniforms.ghosts!,
      spacing: effect.uniforms.spacing!,
      halo: effect.uniforms.halo!,
      haloWidth: effect.uniforms.haloWidth!,
      chromatic: effect.uniforms.chromatic!,
      aspect: { value: 1 },
    });
    const kawase = kit.material(
      kawaseSource,
      {
        source: { value: null },
        texel: { value: vector() },
        offset: { value: 0 },
      },
      samplingPyramidChunks,
    );
    const brightTarget = kit.target(0.25);
    const a = kit.target(0.25);
    const b = kit.target(0.25);
    let width = 1;
    let height = 1;
    return {
      setSize(w, h) {
        width = w;
        height = h;
        kit.setSize(w, h);
      },
      prepare(renderer, input) {
        bright.uniforms.source!.value = input;
        (
          bright.uniforms.texel!.value as InstanceType<typeof three.Vector2>
        ).set(1 / width, 1 / height);
        kit.draw(renderer, bright, brightTarget);
        ghost.uniforms.bright!.value = brightTarget.texture;
        ghost.uniforms.aspect!.value = width / Math.max(height, 1);
        kit.draw(renderer, ghost, a);
        // Soften the ghosts so they read as out-of-focus reflections.
        let read = a;
        let write = b;
        for (let i = 0; i < 3; i++) {
          kawase.uniforms.source!.value = read.texture;
          (
            kawase.uniforms.texel!.value as InstanceType<typeof three.Vector2>
          ).set(1 / read.width, 1 / read.height);
          kawase.uniforms.offset!.value = i;
          kit.draw(renderer, kawase, write);
          [read, write] = [write, read];
        }
        effect.uniforms.flare!.value = read.texture;
      },
      dispose: kit.dispose,
    };
  },
});
