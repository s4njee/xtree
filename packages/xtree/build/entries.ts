/** Library entry points: output name (without .js) to source file. Keep in sync with package.json "exports". */
export const entries = {
  index: 'src/index.ts',
  'glsl/index': 'src/glsl/index.ts',
  'shaders/index': 'src/shaders/index.ts',
  'shaders/noise/index': 'src/shaders/noise/index.ts',
  'shaders/color/index': 'src/shaders/color/index.ts',
  'shaders/blend/index': 'src/shaders/blend/index.ts',
  'effect/index': 'src/effect/index.ts',
  'core/index': 'src/core/index.ts',
  'effects/vignette/index': 'src/effects/vignette/index.ts',
  'effects/chromatic-aberration/index':
    'src/effects/chromatic-aberration/index.ts',
  'effects/bloom/index': 'src/effects/bloom/index.ts',
  'effects/rgb-split-glitch/index': 'src/effects/rgb-split-glitch/index.ts',
  'effects/holographic-foil/index': 'src/effects/holographic-foil/index.ts',
} as const;
