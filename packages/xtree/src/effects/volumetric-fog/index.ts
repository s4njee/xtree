import {
  color,
  createPassKit,
  defineEffect,
  float,
  int,
  seed,
  vec2,
  vec3,
} from '../../effect/index.js';
import {
  depthReconstructChunks,
  noiseValueChunks,
} from '../../shaders/maps.js';
import fragment from './composite.glsl';
import marchSource from './march.glsl';

/** Ray-marched height fog with drifting noise and light scattering. */
export const volumetricFog = defineEffect({
  name: 'volumetric-fog',
  meta: {
    title: 'Volumetric fog',
    family: 'atmosphere',
    story: 'X10.4',
    description:
      'Fog with volume: rays march from the camera through height fog that drifts with noise, collecting light scattered toward the viewer (stronger looking toward the light). It renders at reduced resolution.',
    related: ['depth-fog', 'god-rays', 'ssao'],
  },
  buffers: ['depth'],
  motion: { settle: { windSpeed: 0 } },
  params: {
    density: float({
      default: 0.12,
      min: 0,
      max: 2,
      step: 0.005,
      description: 'Fog density at and below the fog height; 0 turns it off.',
    }),
    height: float({
      default: 0,
      min: -20,
      max: 20,
      step: 0.1,
      unit: 'scene units',
      description: 'World height where the fog starts thinning.',
    }),
    falloff: float({
      default: 0.6,
      min: 0,
      max: 5,
      step: 0.05,
      description: 'How quickly the fog thins above its height.',
    }),
    maxDistance: float({
      default: 40,
      min: 1,
      max: 500,
      step: 1,
      unit: 'scene units',
      description: 'Farthest distance marched, also for the sky.',
    }),
    noise: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How patchy the fog is.',
    }),
    noiseScale: float({
      default: 0.4,
      min: 0.05,
      max: 4,
      step: 0.05,
      description: 'Size of the patches: higher values make smaller ones.',
    }),
    wind: vec2({
      default: [1, 0.3],
      min: -1,
      max: 1,
      description: 'Drift direction across the ground (x, z).',
    }),
    windSpeed: float({
      default: 0.3,
      min: 0,
      max: 3,
      step: 0.05,
      description: 'How fast the patches drift.',
    }),
    light: vec3({
      default: [-0.4, -0.6, -1],
      min: -1,
      max: 1,
      description: 'Direction the light travels, in world space.',
    }),
    anisotropy: float({
      default: 0.5,
      min: -0.9,
      max: 0.9,
      step: 0.05,
      description:
        'Forward scattering: higher values glow more when looking toward the light.',
    }),
    color: color({
      theme: 'surface',
      default: '#9fb2cc',
      description: 'Color of the scattered light.',
    }),
    brightness: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'Brightness of the scattered light.',
    }),
    steps: int({
      default: 24,
      min: 8,
      max: 64,
      step: 4,
      description: 'March steps per ray: more are smoother and slower.',
    }),
    resolution: float({
      default: 0.5,
      min: 0.25,
      max: 1,
      step: 0.25,
      description: 'Fog buffer size relative to the frame.',
    }),
    seed: seed(),
  },
  quality: { low: { steps: 10, resolution: 0.25 }, medium: { steps: 16 } },
  presets: {
    groundMist: { density: 0.4, falloff: 2, height: -0.5, noise: 0.7 },
    haze: { density: 0.05, falloff: 0, noise: 0.2 },
    stormy: {
      density: 0.25,
      windSpeed: 1.2,
      noise: 1,
      color: '#6b7685',
      brightness: 0.7,
    },
    backlit: { anisotropy: 0.75, light: [0, -0.2, 1], brightness: 0.8 },
  },
  textures: ['fog'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect } = context;
    const u = effect.uniforms;
    const march = kit.material(
      marchSource,
      {
        depthBuffer: { value: null },
        inverseProjection: { value: null },
        cameraWorld: { value: null },
        density: u.density!,
        height: u.height!,
        falloff: u.falloff!,
        maxDistance: u.maxDistance!,
        noiseAmount: u.noise!,
        noiseScale: u.noiseScale!,
        wind: { value: [0, 0, 0] },
        time: { value: 0 },
        lightDirection: u.light!,
        anisotropy: u.anisotropy!,
        steps: u.steps!,
        seed: u.seed!,
      },
      depthReconstructChunks,
      noiseValueChunks,
    );
    const target = kit.target(0.5);
    return {
      setSize: kit.setSize,
      prepare(renderer, _input, frame) {
        target.setScale(effect.resolution);
        const m = march.uniforms;
        m.depthBuffer!.value = frame.buffers.depth;
        m.inverseProjection!.value = frame.camera.inverseProjection;
        m.cameraWorld!.value = frame.camera.world;
        const [x, z] = effect.wind;
        m.wind!.value = [x * effect.windSpeed, 0, z * effect.windSpeed];
        m.time!.value = frame.time;
        kit.draw(renderer, march, target);
        effect.uniforms.fog!.value = target.texture;
      },
      dispose: kit.dispose,
    };
  },
});
