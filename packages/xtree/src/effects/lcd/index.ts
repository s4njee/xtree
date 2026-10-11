import {
  createPassKit,
  defineEffect,
  float,
  select,
} from '../../effect/index.js';
import fragment from './composite.glsl';
import persistSource from './persist.glsl';

/** A close-up LCD: subpixel stripes, gaps and slow pixel response. */
export const lcd = defineEffect({
  name: 'lcd',
  meta: {
    title: 'LCD subpixels',
    family: 'retro',
    story: 'X7.7',
    description:
      'A macro view of an LCD: every pixel is three red, green and blue stripes with dark gaps, and slow pixels leave ghosts behind moving things.',
    related: ['crt', 'scanlines', 'pixelate'],
  },
  sampling: 'input',
  params: {
    cellSize: float({
      default: 6,
      min: 3,
      max: 24,
      step: 1,
      unit: 'px',
      description: 'Size of one LCD pixel on screen.',
    }),
    layout: select({
      options: ['rgb', 'bgr', 'diagonal'],
      default: 'rgb',
      structural: true,
      description:
        'Subpixel order: RGB stripes, BGR stripes, or shifted each row.',
      optionLabels: { rgb: 'RGB', bgr: 'BGR' },
    }),
    gap: float({
      default: 0.2,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      description: 'Width of the dark gaps between subpixels.',
    }),
    persistence: float({
      default: 0.4,
      min: 0,
      max: 0.95,
      step: 0.01,
      description:
        'How slowly pixels respond: higher values leave longer ghosts.',
    }),
    brightness: float({
      default: 1.2,
      min: 0.5,
      max: 2,
      step: 0.05,
      description: 'Backlight brightness.',
    }),
    amount: float({
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Mix between the original and the LCD view.',
    }),
  },
  presets: {
    macro: { cellSize: 12, gap: 0.3 },
    handheld: { cellSize: 4, persistence: 0.7 },
    phone: { layout: 'diagonal', cellSize: 5 },
    sharp: { persistence: 0, gap: 0.1 },
  },
  textures: ['persisted'],
  fragment,
  setup(context) {
    const kit = createPassKit(context as never);
    const { effect } = context;
    const persist = kit.material(persistSource, {
      current: { value: null },
      previous: { value: null },
      persistence: effect.uniforms.persistence!,
      first: { value: true },
    });
    const history = [kit.target(1), kit.target(1)] as const;
    let index = 0;
    let first = true;
    return {
      setSize(w, h) {
        kit.setSize(w, h);
        first = true;
      },
      prepare(renderer, input) {
        persist.uniforms.current!.value = input;
        persist.uniforms.previous!.value = history[index]!.texture;
        persist.uniforms.first!.value = first;
        index = 1 - index;
        kit.draw(renderer, persist, history[index]!);
        effect.uniforms.persisted!.value = history[index]!.texture;
        first = false;
      },
      dispose: kit.dispose,
    };
  },
});
