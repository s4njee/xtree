import type { WebGLRenderTarget } from 'three';
import {
  defineEffect,
  float,
  fullscreenVertex,
  int,
  select,
} from '../../effect/index.js';
import fragment from './composite.glsl';
import kawaseSource from './kawase.glsl';
import separableSource from './separable.glsl';

const scales = { full: 1, half: 0.5, quarter: 0.25 } as const;

/** Full-screen blur: separable Gaussian or box, or iterated Kawase. */
export const blur = defineEffect({
  name: 'blur',
  meta: {
    title: 'Blur',
    family: 'glow',
    story: 'X5.1',
    description:
      'Blurs the whole frame with a separable Gaussian, a box filter, or iterated Kawase passes, optionally at reduced resolution for wide, cheap blurs. Use opacity or a blend mode to soften rather than replace.',
    related: ['bloom', 'tilt-shift'],
  },
  sampling: 'input',
  params: {
    mode: select({
      options: ['gaussian', 'box', 'kawase'],
      default: 'gaussian',
      description: 'Blur kernel.',
    }),
    radius: float({
      default: 8,
      min: 0,
      max: 96,
      step: 0.5,
      unit: 'px',
      description: 'Gaussian and box: blur radius in buffer pixels.',
    }),
    iterations: int({
      default: 4,
      min: 1,
      max: 8,
      step: 1,
      description: 'Kawase: number of passes; each widens the blur.',
    }),
    resolution: select({
      options: ['full', 'half', 'quarter'],
      default: 'full',
      description:
        'Buffer size relative to the frame; lower is faster and widens the blur.',
    }),
  },
  presets: {
    soft: { radius: 4 },
    heavy: { radius: 24, resolution: 'half' },
    kawase: { mode: 'kawase', iterations: 5, resolution: 'half' },
    box: { mode: 'box', radius: 6 },
  },
  textures: ['blurred'],
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
    const separable = material(separableSource, {
      source: { value: null },
      direction: { value: new Vector2() },
      radius: { value: 0 },
      box: { value: false },
    });
    const kawase = material(kawaseSource, {
      source: { value: null },
      texel: { value: new Vector2() },
      offset: { value: 0 },
    });
    const options = {
      type: HalfFloatType,
      depthBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
    };
    let targets: WebGLRenderTarget[] = [];
    let width = 1;
    let height = 1;
    let allocated = '';
    const allocate = () => {
      const scale = scales[effect.resolution];
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (allocated === `${w}x${h}`) return;
      for (const target of targets) target.dispose();
      targets = [
        new WebGLRenderTarget(w, h, options),
        new WebGLRenderTarget(w, h, options),
      ];
      allocated = `${w}x${h}`;
    };
    const vector = (uniform: { value: unknown }) =>
      uniform.value as InstanceType<typeof Vector2>;
    return {
      setSize(w, h) {
        width = w;
        height = h;
        allocate();
      },
      prepare(renderer, input) {
        allocate();
        const [a, b] = targets as [WebGLRenderTarget, WebGLRenderTarget];
        const scale = scales[effect.resolution];
        if (effect.mode === 'kawase') {
          let source = input;
          let write = a;
          let read = b;
          for (let i = 0; i < effect.iterations; i++) {
            kawase.uniforms.source!.value = source;
            vector(kawase.uniforms.texel!).set(
              1 / write.width,
              1 / write.height,
            );
            kawase.uniforms.offset!.value = i;
            draw(renderer, kawase, write);
            source = write.texture;
            [write, read] = [read, write];
          }
          effect.uniforms.blurred!.value = source;
          return;
        }
        const radius = effect.radius * scale;
        separable.uniforms.radius!.value = radius;
        separable.uniforms.box!.value = effect.mode === 'box';
        separable.uniforms.source!.value = input;
        vector(separable.uniforms.direction!).set(1 / a.width, 0);
        draw(renderer, separable, a);
        separable.uniforms.source!.value = a.texture;
        vector(separable.uniforms.direction!).set(0, 1 / b.height);
        draw(renderer, separable, b);
        effect.uniforms.blurred!.value = b.texture;
      },
      dispose() {
        for (const target of targets) target.dispose();
        separable.dispose();
        kawase.dispose();
      },
    };
  },
});
