import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { glsl } from '../../build/glsl-plugin.js';

// Serves the GPU fixture page that the Playwright visual and integration tests drive.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [glsl({ minify: false })],
  define: { __XTREE_VERSION__: JSON.stringify('0.0.0-fixture') },
  server: { port: 5179, strictPort: true },
  logLevel: 'warn',
});
