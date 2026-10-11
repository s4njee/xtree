import { createPassKit, defineEffect, float, int } from '../../effect/index.js';
import accumulateSource from './accumulate.glsl';
import brightSource from '../lens-flare/bright.glsl';
import fragment from './composite.glsl';
import streakSource from './streak.glsl';

/** A star filter: crossed light streaks from every highlight. */
export const starStreaks = defineEffect({
  name: 'star-streaks',
  meta: {
    title: 'Star filter',
    family: 'glow',
    story: 'X5.9',
    description:
      'Turns highlights into stars with two, three or more crossing streaks, like a star filter screwed onto a lens.',
    related: ['anamorphic', 'bloom', 'lens-flare'],
  },
  sampling: 'input',
  params: {
    intensity: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Brightness of the streaks.',
    }),
    threshold: float({
      default: 1.2,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Linear brightness above which lights make stars.',
    }),
    lines: int({
      default: 2,
      min: 1,
      max: 6,
      step: 1,
      description:
        'Lines through each star: 2 makes a cross, 3 a six-pointed star.',
    }),
    angle: float({
      default: 25,
      min: 0,
      max: 180,
      step: 1,
      unit: '°',
      description: 'Rotation of the star.',
    }),
    length: float({
      default: 0.9,
      min: 0.5,
      max: 0.98,
      step: 0.01,
      description:
        'How slowly the streaks fade: higher values make longer rays.',
    }),
  },
  presets: {
    cross: { lines: 2, angle: 45 },
    sixPoint: { lines: 3, angle: 0, intensity: 1.3 },
    sparkle: { lines: 4, length: 0.85, threshold: 0.9 },
    long: { length: 0.96, intensity: 0.8 },
  },
  textures: ['star'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect, three } = context;
    type V2 = InstanceType<typeof three.Vector2>;
    const bright = kit.material(brightSource, {
      source: { value: null },
      texel: { value: new three.Vector2() },
      threshold: effect.uniforms.threshold!,
    });
    const streak = kit.material(streakSource, {
      source: { value: null },
      stride: { value: new three.Vector2() },
      attenuation: effect.uniforms.length!,
    });
    const accumulate = kit.material(accumulateSource, {
      previous: { value: null },
      streak: { value: null },
      first: { value: true },
    });
    const brightTarget = kit.target(0.5);
    const work = [kit.target(0.5), kit.target(0.5)] as const;
    const sums = [kit.target(0.5), kit.target(0.5)] as const;
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
        (bright.uniforms.texel!.value as V2).set(0.5 / width, 0.5 / height);
        kit.draw(renderer, bright, brightTarget);
        const lines = effect.lines;
        let sum = 0;
        for (let line = 0; line < lines; line++) {
          const angle =
            (effect.angle * Math.PI) / 180 + (line * Math.PI) / lines;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          let read = brightTarget;
          // Three passes with steps of 1, 4 and 16 texels reach 64 texels at half resolution.
          for (let pass = 0; pass < 3; pass++) {
            const write = work[pass % 2]!;
            const reach = 4 ** pass;
            streak.uniforms.source!.value = read.texture;
            (streak.uniforms.stride!.value as V2).set(
              (dx * reach) / write.width,
              (dy * reach) / write.height,
            );
            kit.draw(renderer, streak, write);
            read = write;
          }
          accumulate.uniforms.streak!.value = read.texture;
          accumulate.uniforms.previous!.value = sums[sum]!.texture;
          accumulate.uniforms.first!.value = line === 0;
          kit.draw(renderer, accumulate, sums[1 - sum]!);
          sum = 1 - sum;
        }
        effect.uniforms.star!.value = sums[sum]!.texture;
      },
      dispose: kit.dispose,
    };
  },
});
