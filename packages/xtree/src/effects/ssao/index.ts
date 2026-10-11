import {
  bool,
  color,
  createPassKit,
  defineEffect,
  float,
  int,
} from '../../effect/index.js';
import { depthReconstructChunks } from '../../shaders/maps.js';
import blurSource from './blur.glsl';
import fragment from './composite.glsl';
import occlusionSource from './occlusion.glsl';

/** Screen-space ambient occlusion from the depth and normal buffers. */
export const ssao = defineEffect({
  name: 'ssao',
  meta: {
    title: 'Ambient occlusion (SSAO)',
    family: 'atmosphere',
    story: 'X10.2',
    description:
      'Darkens creases, corners and contact points where ambient light is blocked, from a normal-oriented hemisphere of samples around each pixel. It renders at reduced resolution and is smoothed by a blur that stops at edges.',
    related: ['depth-fog', 'screen-rim', 'volumetric-fog'],
  },
  buffers: ['depth', 'normal'],
  params: {
    radius: float({
      default: 0.8,
      min: 0.05,
      max: 4,
      step: 0.05,
      unit: 'scene units',
      description: 'How far around each point to look for occluders.',
    }),
    intensity: float({
      default: 2,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Strength of the darkening; 0 turns it off.',
    }),
    samples: int({
      default: 16,
      min: 4,
      max: 64,
      step: 4,
      description: 'Samples per pixel: more are smoother and slower.',
    }),
    bias: float({
      default: 0.02,
      min: 0,
      max: 0.2,
      step: 0.005,
      description:
        'Depth tolerance that stops flat surfaces from shadowing themselves.',
    }),
    blur: float({
      default: 2,
      min: 0,
      max: 8,
      step: 0.5,
      unit: 'px',
      description: 'Radius of the edge-aware blur that smooths the noise.',
    }),
    resolution: float({
      default: 0.5,
      min: 0.25,
      max: 1,
      step: 0.25,
      description: 'Occlusion buffer size relative to the frame.',
    }),
    color: color({
      default: '#000000',
      description: 'Color of fully occluded areas.',
    }),
    debug: bool({
      default: false,
      description: 'Show the occlusion buffer alone.',
    }),
  },
  presets: {
    subtle: { intensity: 0.8, radius: 0.4 },
    contact: { radius: 0.15, intensity: 2, bias: 0.01 },
    wide: { radius: 2, intensity: 1.2, samples: 24 },
    tinted: { color: '#2a1840', intensity: 2 },
    debug: { debug: true },
  },
  textures: ['occlusion'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect } = context;
    const occlusion = kit.material(
      occlusionSource,
      {
        depthBuffer: { value: null },
        normalBuffer: { value: null },
        projection: { value: null },
        inverseProjection: { value: null },
        radius: effect.uniforms.radius!,
        bias: effect.uniforms.bias!,
        samples: effect.uniforms.samples!,
      },
      depthReconstructChunks,
    );
    const blur = kit.material(
      blurSource,
      {
        source: { value: null },
        depthBuffer: { value: null },
        near: { value: 0.1 },
        far: { value: 100 },
        ortho: { value: false },
        direction: { value: [1, 0] },
        radius: effect.uniforms.blur!,
      },
      depthReconstructChunks,
    );
    const targets = [kit.target(0.5), kit.target(0.5)] as const;
    return {
      setSize: kit.setSize,
      prepare(renderer, _input, frame) {
        for (const t of targets) t.setScale(effect.resolution);
        const { camera, buffers } = frame;
        const o = occlusion.uniforms;
        o.depthBuffer!.value = buffers.depth;
        o.normalBuffer!.value = buffers.normal;
        o.projection!.value = camera.projection;
        o.inverseProjection!.value = camera.inverseProjection;
        kit.draw(renderer, occlusion, targets[0]);
        let result = targets[0];
        if (effect.blur > 0) {
          const b = blur.uniforms;
          b.depthBuffer!.value = buffers.depth;
          b.near!.value = camera.near;
          b.far!.value = camera.far;
          b.ortho!.value = camera.orthographic;
          b.source!.value = targets[0].texture;
          b.direction!.value = [1, 0];
          kit.draw(renderer, blur, targets[1]);
          b.source!.value = targets[1].texture;
          b.direction!.value = [0, 1];
          kit.draw(renderer, blur, targets[0]);
          result = targets[0];
        }
        effect.uniforms.occlusion!.value = result.texture;
      },
      dispose: kit.dispose,
    };
  },
});
