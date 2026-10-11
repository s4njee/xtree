import { defineConfig } from 'vitest/config';
import { glsl } from './build/glsl-plugin.js';

export default defineConfig({
  plugins: [glsl({ minify: false })],
  define: { __XTREE_VERSION__: JSON.stringify('0.0.0-test') },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
  },
});
