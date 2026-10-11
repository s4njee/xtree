// Builds the library: JavaScript with Vite, then declarations with tsc.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  root,
  configFile: `${root}/vite.config.ts`,
  mode: 'production',
  logLevel: 'warn',
});
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {
  cwd: root,
  stdio: 'inherit',
});
console.log('Built @mk7s/xtree into dist/.');
