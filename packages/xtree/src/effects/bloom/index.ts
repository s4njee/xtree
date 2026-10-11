import type { WebGLRenderTarget } from 'three';
import {
  color,
  defineEffect,
  float,
  fullscreenVertex,
  int,
} from '../../effect/index.js';
import fragment from './composite.glsl';
import downsampleSource from './downsample.glsl';
import upsampleSource from './upsample.glsl';

/** Physically based bloom: a mip-chain blur of the highlights, added back in linear HDR. */
export const bloom = defineEffect({
  name: 'bloom',
  meta: {
    title: 'Bloom',
    family: 'glow',
    story: 'X5.2',
    description:
      'Light bleeding around bright areas. Highlights above a soft threshold are blurred through a chain of half-resolution buffers and added back before tone mapping.',
    related: ['vignette', 'chromatic-aberration', 'holographic-foil'],
  },
  sampling: 'input',
  params: {
    intensity: float({
      default: 1,
      min: 0,
      max: 4,
      step: 0.05,
      description: 'How much of the blurred light is added back.',
    }),
    threshold: float({
      default: 1,
      min: 0,
      max: 8,
      step: 0.05,
      description:
        'Linear brightness above which pixels bloom. 1 is the brightest non-HDR white.',
    }),
    knee: float({
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'Softness of the threshold, as a fraction of it.',
    }),
    radius: float({
      default: 0.7,
      min: 0,
      max: 1,
      step: 0.01,
      description:
        'Spread: low values keep the glow tight, high values favor the widest blur levels.',
    }),
    levels: int({
      default: 6,
      min: 2,
      max: 8,
      step: 1,
      description:
        'Number of half-resolution blur levels. More levels reach further and cost a little more.',
    }),
    tint: color({
      default: '#ffffff',
      description: 'Color multiplied into the glow.',
    }),
  },
  presets: {
    subtle: { intensity: 0.5, threshold: 1.2 },
    dreamy: { intensity: 1.4, threshold: 0.6, knee: 0.8, radius: 0.85 },
    neon: { intensity: 2, threshold: 0.9, knee: 0.2, radius: 0.5 },
    wide: { levels: 8, radius: 0.9, intensity: 1.2 },
  },
  textures: ['bloom'],
  fragment,
  setup({ three, effect, draw }) {
    const {
      WebGLRenderTarget,
      RawShaderMaterial,
      Vector2,
      GLSL3,
      HalfFloatType,
      LinearFilter,
      ClampToEdgeWrapping,
    } = three;
    const material = (
      fragmentShader: string,
      uniforms: Record<string, { value: unknown }>,
    ) =>
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: fullscreenVertex,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
    const down = material(downsampleSource, {
      source: { value: null },
      texel: { value: new Vector2() },
      prefilter: { value: true },
      threshold: effect.uniforms.threshold!,
      knee: effect.uniforms.knee!,
    });
    const up = material(upsampleSource, {
      low: { value: null },
      high: { value: null },
      texel: { value: new Vector2() },
      scatter: effect.uniforms.radius!,
    });
    let downTargets: WebGLRenderTarget[] = [];
    let upTargets: WebGLRenderTarget[] = [];
    let width = 1;
    let height = 1;
    let levels = 0;
    const release = () => {
      for (const target of [...downTargets, ...upTargets]) target.dispose();
      downTargets = [];
      upTargets = [];
    };
    const allocate = () => {
      release();
      levels = effect.levels;
      const options = {
        type: HalfFloatType,
        depthBuffer: false,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        wrapS: ClampToEdgeWrapping,
        wrapT: ClampToEdgeWrapping,
      };
      let w = width;
      let h = height;
      for (let i = 0; i < levels; i++) {
        w = Math.max(1, Math.floor(w / 2));
        h = Math.max(1, Math.floor(h / 2));
        downTargets.push(new WebGLRenderTarget(w, h, options));
        if (i < levels - 1)
          upTargets.push(new WebGLRenderTarget(w, h, options));
      }
    };
    return {
      setSize(w, h) {
        width = w;
        height = h;
        allocate();
      },
      prepare(renderer, input) {
        if (effect.levels !== levels) allocate();
        let source = input;
        let sourceWidth = width;
        let sourceHeight = height;
        downTargets.forEach((target, i) => {
          down.uniforms.source!.value = source;
          (down.uniforms.texel!.value as InstanceType<typeof Vector2>).set(
            1 / sourceWidth,
            1 / sourceHeight,
          );
          down.uniforms.prefilter!.value = i === 0;
          draw(renderer, down, target);
          source = target.texture;
          sourceWidth = target.width;
          sourceHeight = target.height;
        });
        let low = downTargets.at(-1)!;
        for (let i = levels - 2; i >= 0; i--) {
          up.uniforms.low!.value = low.texture;
          up.uniforms.high!.value = downTargets[i]!.texture;
          (up.uniforms.texel!.value as InstanceType<typeof Vector2>).set(
            1 / low.width,
            1 / low.height,
          );
          draw(renderer, up, upTargets[i]!);
          low = upTargets[i]!;
        }
        effect.uniforms.bloom!.value = low.texture;
      },
      dispose() {
        release();
        down.dispose();
        up.dispose();
      },
    };
  },
});
