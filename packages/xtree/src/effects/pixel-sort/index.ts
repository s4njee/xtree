import {
  bool,
  createPassKit,
  defineEffect,
  float,
  int,
  select,
} from '../../effect/index.js';
import fragment from './composite.glsl';
import copySource from './copy.glsl';
import sortSource from './sort.glsl';

/** Pixel sorting: runs of pixels sorted by brightness or hue into streaks. */
export const pixelSort = defineEffect({
  name: 'pixel-sort',
  meta: {
    title: 'Pixel sort',
    family: 'glitch',
    story: 'X6.6',
    description:
      'Sorts runs of pixels by brightness or hue along rows or columns, the glitch-art streaks of pixel sorting. Only pixels between two brightness thresholds move.',
    related: ['datamosh', 'slice-shift', 'jpeg'],
  },
  sampling: 'input',
  params: {
    low: float({
      default: 0.1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Pixels darker than this stay put and end sorted runs.',
    }),
    high: float({
      default: 0.9,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Pixels brighter than this stay put and end sorted runs.',
    }),
    direction: select({
      options: ['horizontal', 'vertical'],
      default: 'vertical',
      description: 'Sort along rows or columns.',
    }),
    sortBy: select({
      options: ['brightness', 'hue'],
      default: 'brightness',
      description: 'What pixels are sorted by.',
    }),
    reverse: bool({ default: false, description: 'Sort in descending order.' }),
    iterations: int({
      default: 64,
      min: 4,
      max: 256,
      step: 4,
      description:
        'Sorting steps; each lets a pixel move one place, so more make longer streaks.',
    }),
    resolution: float({
      default: 0.5,
      min: 0.25,
      max: 1,
      step: 0.25,
      description:
        'Sorting buffer size relative to the frame; lower is faster and stretches streaks.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the sorted image.',
    }),
  },
  quality: {
    low: { iterations: 24, resolution: 0.25 },
    medium: { iterations: 40 },
  },
  presets: {
    waterfall: { direction: 'vertical', iterations: 160, low: 0.05 },
    rainbow: { sortBy: 'hue', direction: 'horizontal', iterations: 96 },
    highlights: { low: 0.3, high: 1, iterations: 128 },
    shadows: { low: 0, high: 0.4, reverse: true },
  },
  textures: ['sorted'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect } = context;
    const sort = kit.material(sortSource, {
      source: { value: null },
      iteration: { value: 0 },
      vertical: { value: true },
      reverse: effect.uniforms.reverse!,
      key: { value: 0 },
      low: effect.uniforms.low!,
      high: effect.uniforms.high!,
    });
    const copy = kit.material(copySource, { source: { value: null } });
    const targets = [kit.target(0.5), kit.target(0.5)] as const;
    return {
      setSize: kit.setSize,
      prepare(renderer, input) {
        for (const t of targets) t.setScale(effect.resolution);
        copy.uniforms.source!.value = input;
        kit.draw(renderer, copy, targets[0]);
        sort.uniforms.vertical!.value = effect.direction === 'vertical';
        sort.uniforms.key!.value = effect.sortBy === 'hue' ? 1 : 0;
        let read = 0;
        for (let i = 0; i < effect.iterations; i++) {
          sort.uniforms.source!.value = targets[read]!.texture;
          sort.uniforms.iteration!.value = i;
          kit.draw(renderer, sort, targets[1 - read]!);
          read = 1 - read;
        }
        effect.uniforms.sorted!.value = targets[read]!.texture;
      },
      dispose: kit.dispose,
    };
  },
});
