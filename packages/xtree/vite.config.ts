import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { entries } from './build/entries.js';
import { glsl } from './build/glsl-plugin.js';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig(({ mode }) => ({
  plugins: [glsl({ minify: mode === 'production' })],
  define: { __XTREE_VERSION__: JSON.stringify(version) },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
    lib: { entry: entries, formats: ['es'] },
    rolldownOptions: {
      external: [/^three(\/.*)?$/],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
}));
