/** Library entry points: output name (without .js) to source file. Keep in sync with package.json "exports". */
export const entries = {
  index: 'src/index.ts',
  'glsl/index': 'src/glsl/index.ts',
  'shaders/index': 'src/shaders/index.ts',
  'shaders/noise/index': 'src/shaders/noise/index.ts',
  'shaders/color/index': 'src/shaders/color/index.ts',
  'shaders/blend/index': 'src/shaders/blend/index.ts',
} as const;
