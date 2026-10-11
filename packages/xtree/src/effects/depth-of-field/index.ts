import {
  bool,
  createPassKit,
  defineEffect,
  float,
  select,
  vec2,
} from '../../effect/index.js';
import {
  depthReconstructChunks,
  samplingSpiralChunks,
} from '../../shaders/maps.js';
import gatherSource from './gather.glsl';
import fragment from './shader.glsl';

/** Camera-style depth of field with round or hexagonal bokeh. */
export const depthOfField = defineEffect({
  name: 'depth-of-field',
  meta: {
    title: 'Depth of field',
    family: 'lens',
    story: 'X4.4',
    description:
      'Blurs what is nearer or farther than the focus distance, as a wide-aperture lens does. Bright highlights open into round or hexagonal bokeh, and focus can follow a point on screen.',
    related: ['tilt-shift', 'blur', 'depth-fog'],
  },
  sampling: 'input',
  buffers: ['depth'],
  chunks: [samplingSpiralChunks],
  params: {
    focusMode: select({
      options: ['distance', 'point'],
      default: 'distance',
      description:
        'Focus at a fixed distance, or on whatever is under the focus point.',
    }),
    focusDistance: float({
      default: 7,
      min: 0.1,
      max: 100,
      step: 0.1,
      description: 'Distance mode: distance in focus, in scene units.',
    }),
    focusPoint: vec2({
      default: [0.5, 0.5],
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Point mode: screen position to focus on, in UV coordinates.',
    }),
    focusRange: float({
      default: 1.5,
      min: 0,
      max: 50,
      step: 0.1,
      description: 'Depth around the focus distance that stays sharp.',
    }),
    aperture: float({
      default: 2,
      min: 0,
      max: 10,
      step: 0.05,
      description: 'Lens opening: larger values blur sooner away from focus.',
    }),
    maxBlur: float({
      default: 12,
      min: 1,
      max: 32,
      step: 0.5,
      unit: 'px',
      description: 'Largest blur radius.',
    }),
    shape: select({
      options: ['circle', 'hexagon'],
      default: 'circle',
      description: 'Bokeh shape.',
    }),
    density: select({
      options: ['low', 'medium', 'high'],
      default: 'medium',
      description:
        'Sample density. Cost grows with the square of the blur radius.',
    }),
    resolution: select({
      options: ['full', 'half'],
      default: 'full',
      structural: true,
      description:
        'Gather the blur at full or half resolution. Half is about four times cheaper; in-focus pixels stay sharp at full resolution, and the blur is upsampled with depth-aware weights.',
    }),
    showFocus: bool({
      default: false,
      description:
        'Tint what is in focus green, near blur red and far blur blue.',
    }),
  },
  quality: {
    low: { density: 'low', resolution: 'half' },
    medium: { density: 'low' },
  },
  presets: {
    portrait: { focusDistance: 7, focusRange: 0.8, aperture: 4, maxBlur: 16 },
    macro: { focusDistance: 5.2, focusRange: 0.3, aperture: 8, maxBlur: 20 },
    hexBokeh: { shape: 'hexagon', aperture: 3, maxBlur: 18 },
    subtle: { aperture: 1, maxBlur: 6, density: 'low' },
  },
  textures: ['gathered'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect } = context;
    const value = (v: unknown) => ({ value: v });
    const gather = kit.material(
      gatherSource,
      {
        source: value(null),
        depthBuffer: value(null),
        near: value(0.1),
        far: value(100),
        ortho: value(false),
        focusMode: value(0),
        focusDistance: value(0),
        focusPoint: value([0.5, 0.5]),
        focusRange: value(0),
        aperture: value(0),
        maxBlur: value(0),
        shape: value(0),
        spacing: value(1),
        scale: value(0.5),
      },
      depthReconstructChunks,
      samplingSpiralChunks,
    );
    const half = kit.target(0.5);
    return {
      setSize: kit.setSize,
      prepare(renderer, input, frame) {
        if (effect.resolution !== 'half') return;
        const g = gather.uniforms;
        g.source!.value = input;
        g.depthBuffer!.value = frame.buffers.depth;
        g.near!.value = frame.camera.near;
        g.far!.value = frame.camera.far;
        g.ortho!.value = frame.camera.orthographic;
        g.focusMode!.value = effect.focusMode === 'point' ? 1 : 0;
        g.focusDistance!.value = effect.focusDistance;
        g.focusPoint!.value = effect.focusPoint;
        g.focusRange!.value = effect.focusRange;
        g.aperture!.value = effect.aperture;
        g.maxBlur!.value = effect.maxBlur;
        g.shape!.value = effect.shape === 'hexagon' ? 1 : 0;
        g.spacing!.value =
          effect.density === 'low' ? 2 : effect.density === 'medium' ? 1 : 0.5;
        kit.draw(renderer, gather, half);
        effect.uniforms.gathered!.value = half.texture;
      },
      dispose: kit.dispose,
    };
  },
});
