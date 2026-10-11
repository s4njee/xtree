import {
  color,
  createPassKit,
  defineEffect,
  float,
  int,
  seed,
} from '../../effect/index.js';
import { noiseValueChunks, samplingPyramidChunks } from '../../shaders/maps.js';
import kawaseSource from '../lens-flare/kawase.glsl';
import fragment from './composite.glsl';

/** A frosted-glass pane over the frame, like a backdrop blur. */
export const frostedGlass = defineEffect({
  name: 'frosted-glass',
  meta: {
    title: 'Frosted glass',
    family: 'glow',
    story: 'X5.8',
    description:
      'Looks through a pane of frosted glass: a backdrop blur with ripples, a tint and fine grain, matching HoloCSS’s Glass theme. Give it a mask to frost only a panel.',
    related: ['blur', 'bokeh-blur', 'holographic-foil'],
  },
  sampling: 'input',
  chunks: [noiseValueChunks],
  params: {
    blur: int({
      default: 4,
      min: 1,
      max: 8,
      step: 1,
      description: 'Blur passes; each roughly doubles the blur radius.',
    }),
    distortion: float({
      default: 6,
      min: 0,
      max: 30,
      step: 0.5,
      unit: 'px',
      description: 'How far the frost ripples bend the view.',
    }),
    frostScale: float({
      default: 6,
      min: 1,
      max: 40,
      step: 0.5,
      unit: 'px',
      description: 'Size of the ripples.',
    }),
    tint: color({
      theme: 'surface',
      default: '#dfe8f5',
      description: 'Color of the glass.',
    }),
    tintAmount: float({
      default: 0.25,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How strongly the glass color shows.',
    }),
    grain: float({
      default: 0.03,
      min: 0,
      max: 0.2,
      step: 0.005,
      description: 'Fine frost texture.',
    }),
    seed: seed(),
  },
  presets: {
    bathroom: { blur: 6, distortion: 14, frostScale: 4 },
    glassPanel: { blur: 5, distortion: 2, tintAmount: 0.35, grain: 0.01 },
    icy: { tint: '#cfe9ff', tintAmount: 0.45, grain: 0.06 },
    clear: { blur: 2, distortion: 3, tintAmount: 0.1 },
  },
  textures: ['blurred'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect, three } = context;
    type V2 = InstanceType<typeof three.Vector2>;
    const kawase = kit.material(
      kawaseSource,
      {
        source: { value: null },
        texel: { value: new three.Vector2() },
        offset: { value: 0 },
      },
      samplingPyramidChunks,
    );
    const a = kit.target(0.5);
    const b = kit.target(0.5);
    return {
      setSize: kit.setSize,
      prepare(renderer, input) {
        let source = input;
        let write = a;
        let spare = b;
        for (let i = 0; i < effect.blur; i++) {
          kawase.uniforms.source!.value = source;
          (kawase.uniforms.texel!.value as V2).set(
            1 / write.width,
            1 / write.height,
          );
          kawase.uniforms.offset!.value = i;
          kit.draw(renderer, kawase, write);
          source = write.texture;
          [write, spare] = [spare, write];
        }
        effect.uniforms.blurred!.value = source;
      },
      dispose: kit.dispose,
    };
  },
});
