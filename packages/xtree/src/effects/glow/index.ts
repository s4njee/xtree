import type { WebGLRenderTarget } from 'three';
import {
  color,
  defineEffect,
  float,
  fullscreenVertex,
  select,
} from '../../effect/index.js';
import separableSource from '../blur/separable.glsl';
import fragment from './composite.glsl';
import sourceShader from './source.glsl';

/** A soft colored halo around selected objects, or around bright areas. */
export const glow = defineEffect({
  name: 'glow',
  meta: {
    title: 'Glow',
    family: 'glow',
    story: 'X5.4',
    description:
      'A soft colored halo around selected objects, like an outer glow in an image editor. Without a mask the halo surrounds areas brighter than the threshold.',
    related: ['selective-bloom', 'outline', 'bloom'],
    demo: { selection: ['box', 'gem'] },
  },
  sampling: 'input',
  masking: 'custom',
  params: {
    color: color({ default: '#5ad8ff', description: 'Halo color.' }),
    intensity: float({
      default: 2,
      min: 0,
      max: 10,
      step: 0.05,
      description:
        'Brightness of the halo, in linear units (above 1 blooms with HDR effects).',
    }),
    radius: float({
      default: 16,
      min: 1,
      max: 64,
      step: 0.5,
      unit: 'px',
      description: 'How far the halo spreads.',
    }),
    mode: select({
      options: ['outer', 'both'],
      default: 'outer',
      description: 'Halo only outside the selection, or over it as well.',
    }),
    threshold: float({
      default: 1,
      min: 0,
      max: 8,
      step: 0.05,
      description: 'Without a mask: linear brightness that starts to glow.',
    }),
  },
  presets: {
    aura: { radius: 28, intensity: 1.5 },
    hover: { color: '#ffd166', radius: 10, intensity: 3 },
    danger: { color: '#ff4d6d', radius: 20, intensity: 2.5, mode: 'both' },
    soft: { radius: 40, intensity: 1 },
  },
  textures: ['glow'],
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
    const source = material(sourceShader, {
      source: { value: null },
      useMask: { value: false },
      mask: effect.uniforms.xtMask!,
      maskChannel: effect.uniforms.xtMaskChannel!,
      maskInvert: effect.uniforms.xtMaskInvert!,
      threshold: effect.uniforms.threshold!,
    });
    const blur = material(separableSource, {
      source: { value: null },
      direction: { value: new Vector2() },
      radius: { value: 1 },
      box: { value: false },
    });
    const options = {
      type: HalfFloatType,
      depthBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
    };
    // Half resolution: the halo is soft, and the blur radius halves with it.
    let targets: [WebGLRenderTarget, WebGLRenderTarget] | null = null;
    return {
      setSize(width, height) {
        targets?.forEach((t) => t.dispose());
        const w = Math.max(1, Math.floor(width / 2));
        const h = Math.max(1, Math.floor(height / 2));
        targets = [
          new WebGLRenderTarget(w, h, options),
          new WebGLRenderTarget(w, h, options),
        ];
      },
      prepare(renderer, input) {
        const [a, b] = targets!;
        const kind = effect.maskKind;
        source.uniforms.useMask!.value =
          kind === 'texture' || kind === 'selection';
        source.uniforms.source!.value = input;
        draw(renderer, source, a);
        const direction = blur.uniforms.direction!.value as InstanceType<
          typeof Vector2
        >;
        blur.uniforms.radius!.value = Math.min(effect.radius / 2, 96);
        blur.uniforms.source!.value = a.texture;
        direction.set(1 / a.width, 0);
        draw(renderer, blur, b);
        blur.uniforms.source!.value = b.texture;
        direction.set(0, 1 / a.height);
        draw(renderer, blur, a);
        effect.uniforms.glow!.value = a.texture;
      },
      dispose() {
        targets?.forEach((t) => t.dispose());
        source.dispose();
        blur.dispose();
      },
    };
  },
});
