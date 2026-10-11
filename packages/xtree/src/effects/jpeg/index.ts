import {
  bool,
  createPassKit,
  defineEffect,
  float,
} from '../../effect/index.js';
import fragment from './composite.glsl';
import forwardColumnsSource from './forward-columns.glsl';
import forwardRowsSource from './forward-rows.glsl';
import inverseColumnsSource from './inverse-columns.glsl';

/** Real JPEG compression artifacts: an 8×8 DCT, quantized at a chosen quality. */
export const jpeg = defineEffect({
  name: 'jpeg',
  meta: {
    title: 'JPEG artifacts',
    family: 'glitch',
    story: 'X6.7',
    description:
      'Compresses each frame the way JPEG does (8×8 DCT blocks quantized with the standard tables, color at quarter resolution) and decodes it again, for blocky, ringing, smeared-color artifacts at low quality.',
    related: ['bit-crush', 'datamosh', 'pixelate'],
  },
  sampling: 'input',
  params: {
    quality: float({
      default: 15,
      min: 1,
      max: 100,
      step: 1,
      description:
        'JPEG quality: 100 is nearly lossless, below 10 is a mess of blocks.',
    }),
    blockScale: float({
      default: 1,
      min: 1,
      max: 6,
      step: 1,
      unit: 'px',
      description: 'Screen pixels per JPEG pixel, for bigger blocks.',
    }),
    subsample: bool({
      default: true,
      description:
        'Store color at quarter resolution (4:2:0), as most JPEGs do.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the compressed image.',
    }),
  },
  presets: {
    lowQuality: { quality: 6 },
    deepFried: { quality: 2, blockScale: 2 },
    web: { quality: 40 },
    macroblocks: { quality: 10, blockScale: 4 },
  },
  textures: ['blocks'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect, three } = context;
    type V2 = InstanceType<typeof three.Vector2>;
    const rows = kit.material(forwardRowsSource, {
      source: { value: null },
      size: { value: new three.Vector2() },
      subsample: effect.uniforms.subsample!,
    });
    const columns = kit.material(forwardColumnsSource, {
      rows: { value: null },
      scale: { value: 1 },
    });
    const inverse = kit.material(inverseColumnsSource, {
      coefficients: { value: null },
    });
    const a = kit.target(1);
    const b = kit.target(1);
    return {
      setSize: kit.setSize,
      prepare(renderer, input) {
        const scale = 1 / effect.blockScale;
        a.setScale(scale);
        b.setScale(scale);
        // libjpeg's quality scaling of the quantization tables.
        const q = Math.min(100, Math.max(1, effect.quality));
        const s = q < 50 ? 5000 / q : 200 - 2 * q;
        columns.uniforms.scale!.value = s / 100;
        rows.uniforms.source!.value = input;
        (rows.uniforms.size!.value as V2).set(a.width, a.height);
        kit.draw(renderer, rows, a);
        columns.uniforms.rows!.value = a.texture;
        kit.draw(renderer, columns, b);
        inverse.uniforms.coefficients!.value = b.texture;
        kit.draw(renderer, inverse, a);
        effect.uniforms.blocks!.value = a.texture;
      },
      dispose: kit.dispose,
    };
  },
});
