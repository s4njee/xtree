import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { ensureHolocss } from '../../../../scripts/holocss.mjs';
import { glsl } from '../../build/glsl-plugin.js';

// HoloCSS source at the pinned commit, for testing transitions with its real transition3d().
const holocss: string = ensureHolocss();

// Serves the GPU fixture page that the Playwright visual and integration tests drive.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [glsl({ minify: false })],
  define: { __XTREE_VERSION__: JSON.stringify('0.0.0-fixture') },
  resolve: {
    alias: [
      {
        find: /^@holocss\/runtime$/,
        replacement: resolve(holocss, 'src/runtime/index.ts'),
      },
      {
        find: /^@holocss\/three$/,
        replacement: resolve(holocss, 'src/three/index.ts'),
      },
    ],
    // HoloCSS's source has no node_modules; resolve its `three` import to ours.
    dedupe: ['three'],
  },
  server: {
    port: 5179,
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL('../../../..', import.meta.url)), holocss],
    },
  },
  logLevel: 'warn',
});
