import {
  color,
  createPassKit,
  defineEffect,
  float,
  select,
} from '../../effect/index.js';
import brightSource from '../lens-flare/bright.glsl';
import fragment from './composite.glsl';
import streakSource from './streak.glsl';

/** The long horizontal flares of anamorphic lenses. */
export const anamorphic = defineEffect({
  name: 'anamorphic',
  meta: {
    title: 'Anamorphic streaks',
    family: 'lens',
    story: 'X4.7',
    description:
      'Stretches bright lights into long horizontal lines, the blue flares of anamorphic cinema lenses.',
    related: ['lens-flare', 'star-streaks', 'bloom'],
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
      default: 1,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Linear brightness above which lights streak.',
    }),
    length: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Length of the streaks.',
    }),
    tint: color({
      theme: 'accent',
      default: '#6fa8ff',
      description: 'Color of the streaks.',
    }),
    direction: select({
      options: ['horizontal', 'vertical'],
      default: 'horizontal',
      description: 'Orientation of the streaks.',
    }),
  },
  presets: {
    cinema: { intensity: 1.4, length: 0.8 },
    warm: { tint: '#ffb36b' },
    subtle: { intensity: 0.5, length: 0.4 },
    vertical: { direction: 'vertical', length: 0.5 },
  },
  textures: ['streaks'],
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
    });
    const brightTarget = kit.target(0.5);
    const a = kit.target(0.5);
    const b = kit.target(0.5);
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
        // Each iteration triples the reach; length sets how many run.
        const iterations = 1 + Math.round(effect.length * 5);
        const vertical = effect.direction === 'vertical';
        let read = brightTarget;
        let write = a;
        let spare = b;
        for (let i = 0; i < iterations; i++) {
          const reach = 3 ** i;
          streak.uniforms.source!.value = read.texture;
          (streak.uniforms.stride!.value as V2).set(
            vertical ? 0 : reach / write.width,
            vertical ? reach / write.height : 0,
          );
          kit.draw(renderer, streak, write);
          read = write;
          [write, spare] = [spare, write];
        }
        effect.uniforms.streaks!.value = read.texture;
      },
      dispose: kit.dispose,
    };
  },
});
