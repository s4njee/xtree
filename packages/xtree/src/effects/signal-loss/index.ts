import {
  createPassKit,
  defineEffect,
  float,
  int,
  select,
} from '../../effect/index.js';
import { noiseHashChunks } from '../../shaders/maps.js';
import fragment from './composite.glsl';
import copySource from './copy.glsl';

/** A deterministic hash of an integer step and a seed, in [0, 1). */
function hash(step: number, seed: number): number {
  let h =
    (Math.imul(step | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Digital signal dropouts: the picture freezes or breaks up for a moment. */
export const signalLoss = defineEffect({
  name: 'signal-loss',
  meta: {
    title: 'Signal loss',
    family: 'glitch',
    story: 'X6.10',
    description:
      'Brief digital dropouts: now and then the picture freezes on its last good frame (or falls to noise), torn by bands of static, then recovers.',
    related: ['datamosh', 'digital-noise', 'scanline-tear'],
  },
  sampling: 'input',
  chunks: [noiseHashChunks],
  motion: 'freeze',
  params: {
    frequency: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description:
        'Chances per second of a dropout (at most one a second, for photosensitivity).',
    }),
    chance: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'Probability that each chance turns into a dropout.',
    }),
    duration: float({
      default: 0.4,
      min: 0.05,
      max: 1,
      step: 0.05,
      unit: 's',
      description: 'Length of each dropout.',
    }),
    mode: select({
      options: ['freeze', 'noise'],
      default: 'freeze',
      structural: true,
      description: 'Freeze on the last good frame, or fall to noise.',
    }),
    severity: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How much static and block damage covers the dropout.',
    }),
    seed: int({
      default: 0,
      min: 0,
      max: 99,
      step: 1,
      description: 'Picks a different schedule of dropouts.',
    }),
  },
  presets: {
    satellite: { frequency: 0.6, duration: 0.6, severity: 0.8 },
    rare: { frequency: 0.25, chance: 0.5, duration: 0.3 },
    freezeOnly: { severity: 0 },
    noise: { mode: 'noise', duration: 0.25 },
  },
  textures: ['held'],
  state: { dropout: 'float', phase: 'float' },
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect } = context;
    const copy = kit.material(copySource, { source: { value: null } });
    const held = kit.target(1);
    effect.uniforms.held!.value = held.texture;
    return {
      setSize: kit.setSize,
      prepare(renderer, input, frame) {
        // Dropouts happen at most once per window of 1/frequency seconds, starting at a random point in it.
        const frequency = effect.frequency;
        let active = false;
        let phase = 0;
        if (frequency > 0) {
          const window = 1 / frequency;
          const step = Math.floor(frame.time / window);
          const start =
            step * window + hash(step, effect.seed + 1) * window * 0.5;
          active =
            hash(step, effect.seed) < effect.chance &&
            frame.time >= start &&
            frame.time < start + Math.min(effect.duration, window * 0.5);
          phase = frame.time - start;
        }
        effect.uniforms.dropout!.value = active ? 1 : 0;
        effect.uniforms.phase!.value = phase;
        // Keep the last good frame for freezes.
        if (!active) {
          copy.uniforms.source!.value = input;
          kit.draw(renderer, copy, held);
        }
        effect.uniforms.held!.value = held.texture;
      },
      dispose: kit.dispose,
    };
  },
});
