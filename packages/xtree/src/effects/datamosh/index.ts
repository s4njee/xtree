import {
  createPassKit,
  defineEffect,
  float,
  select,
} from '../../effect/index.js';
import fragment from './composite.glsl';
import copySource from './copy.glsl';
import moshSource from './mosh.glsl';

/** Datamoshing: motion smears old pixels across the frame until the next keyframe. */
export const datamosh = defineEffect({
  name: 'datamosh',
  meta: {
    title: 'Datamosh',
    family: 'glitch',
    story: 'X6.5',
    description:
      'The look of a video with its keyframes removed: motion drags the old picture along in blocks, smearing it into the new one until the next keyframe resets it. Motion comes from the velocity buffer or from a light optical flow of the image.',
    related: ['pixel-sort', 'jpeg', 'motion-blur'],
  },
  sampling: 'input',
  buffers: (effect) => (effect.source === 'velocity' ? ['velocity'] : []),
  motion: 'freeze',
  params: {
    source: select({
      options: ['velocity', 'flow'],
      default: 'flow',
      structural: true,
      description:
        'Where motion comes from: the scene’s velocity buffer, or optical flow estimated from the image (works on video and 2D content too).',
    }),
    blockSize: float({
      default: 16,
      min: 4,
      max: 64,
      step: 4,
      unit: 'px',
      description: 'Size of the motion blocks, like video macroblocks.',
    }),
    strength: float({
      default: 1.5,
      min: 0,
      max: 6,
      step: 0.05,
      description: 'How far each frame’s motion pushes the old picture.',
    }),
    refresh: float({
      default: 0.04,
      min: 0,
      max: 0.5,
      step: 0.01,
      description:
        'How much of the new frame bleeds in each frame; 0 never recovers until a keyframe.',
    }),
    keyframeInterval: float({
      default: 3,
      min: 0.5,
      max: 20,
      step: 0.5,
      unit: 's',
      description:
        'Seconds between keyframes, which restore the clean picture.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the moshed image.',
    }),
  },
  presets: {
    melt: { strength: 3, refresh: 0.01, keyframeInterval: 6 },
    blocky: { blockSize: 32, strength: 2 },
    subtle: { strength: 0.8, refresh: 0.1 },
    scene: { source: 'velocity', strength: 2 },
  },
  textures: ['moshed'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect, three } = context;
    type V2 = InstanceType<typeof three.Vector2>;
    const mosh = kit.material(moshSource, {
      current: { value: null },
      previousInput: { value: null },
      previousMosh: { value: null },
      velocity: { value: null },
      useVelocity: { value: false },
      keyframe: { value: true },
      blockSize: effect.uniforms.blockSize!,
      strength: effect.uniforms.strength!,
      refresh: effect.uniforms.refresh!,
      resolution: { value: new three.Vector2() },
    });
    const copy = kit.material(copySource, { source: { value: null } });
    const moshes = [kit.target(1), kit.target(1)] as const;
    const previousInput = kit.target(1);
    let index = 0;
    let lastKey = Number.NaN;
    let width = 1;
    let height = 1;
    return {
      setSize(w, h) {
        width = w;
        height = h;
        kit.setSize(w, h);
        lastKey = Number.NaN;
      },
      prepare(renderer, input, frame) {
        // While time stands still (paused, or motion off) the moshed frame holds.
        if (frame.delta === 0 && !Number.isNaN(lastKey)) {
          effect.uniforms.moshed!.value = moshes[index]!.texture;
          return;
        }
        const key = Math.floor(frame.time / effect.keyframeInterval);
        mosh.uniforms.keyframe!.value = key !== lastKey;
        lastKey = key;
        mosh.uniforms.current!.value = input;
        mosh.uniforms.previousInput!.value = previousInput.texture;
        mosh.uniforms.previousMosh!.value = moshes[index]!.texture;
        mosh.uniforms.useVelocity!.value = effect.source === 'velocity';
        mosh.uniforms.velocity!.value = frame.buffers.velocity;
        (mosh.uniforms.resolution!.value as V2).set(width, height);
        index = 1 - index;
        kit.draw(renderer, mosh, moshes[index]!);
        effect.uniforms.moshed!.value = moshes[index]!.texture;
        copy.uniforms.source!.value = input;
        kit.draw(renderer, copy, previousInput);
      },
      dispose: kit.dispose,
    };
  },
});
