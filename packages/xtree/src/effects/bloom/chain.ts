import type { WebGLRenderTarget } from 'three';
import type { EffectResources, SetupContext } from '../../effect/define.js';
import { fullscreenVertex } from '../../effect/index.js';
import type { ParamSchema } from '../../effect/params.js';
import { samplingPyramidChunks } from '../../shaders/maps.js';
import downsampleSource from './downsample.glsl';
import upsampleSource from './upsample.glsl';

/** The parameters the bloom chain reads. */
interface BloomValues {
  readonly levels: number;
}

/**
 * The bloom mip chain: a thresholded 13-tap downsample into `levels`
 * half-resolution buffers, then tent upsamples back, leaving the result in
 * the effect's `bloom` texture. With `masked`, the effect's texture or
 * selection mask limits which pixels bloom, and `luminance: 'all'` blooms
 * every masked pixel regardless of the threshold.
 */
export function bloomChain(
  context: SetupContext<ParamSchema>,
  masked = false,
): EffectResources {
  const { three, draw, include } = context;
  const effect =
    context.effect as unknown as SetupContext<ParamSchema>['effect'] &
      BloomValues & { readonly luminance?: string };
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
  const down = material(include(downsampleSource, samplingPyramidChunks), {
    source: { value: null },
    texel: { value: new Vector2() },
    prefilter: { value: true },
    threshold: effect.uniforms.threshold!,
    knee: effect.uniforms.knee!,
    useMask: { value: false },
    maskOnly: { value: false },
    mask: effect.uniforms.xtMask!,
    maskChannel: effect.uniforms.xtMaskChannel!,
    maskInvert: effect.uniforms.xtMaskInvert!,
  });
  const up = material(include(upsampleSource, samplingPyramidChunks), {
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
      if (i < levels - 1) upTargets.push(new WebGLRenderTarget(w, h, options));
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
      const kind = effect.maskKind;
      const useMask = masked && (kind === 'texture' || kind === 'selection');
      down.uniforms.useMask!.value = useMask;
      down.uniforms.maskOnly!.value = useMask && effect.luminance === 'all';
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
}
