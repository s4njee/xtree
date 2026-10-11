// The benchmark harness (X17.2): renders a fixed scene and camera path in
// Chromium with each effect and prints what each adds to the frame time
// (and GPU time where timer queries are available).
//
//   pnpm bench [effect ...] [--frames 40] [--size 1280x720] [--out file] [--label name]
//
// With --out, results are merged into that JSON file (bench/results/*.json
// is what the docs show).
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const options = {
  effects: [],
  frames: 40,
  width: 1280,
  height: 720,
  out: null,
  label: null,
};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--frames') options.frames = Number(args[++i]);
  else if (arg === '--size')
    [options.width, options.height] = args[++i].split('x').map(Number);
  else if (arg === '--out') options.out = resolve(args[++i]);
  else if (arg === '--label') options.label = args[++i];
  else options.effects.push(arg);
}
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'playwright',
    'test',
    'packages/xtree/test/browser/bench.spec.ts',
    '--reporter=line',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      XT_BENCH: JSON.stringify(options),
      XT_BROWSERS: process.env.XT_BROWSERS ?? 'chromium',
    },
  },
);
process.exit(result.status ?? 1);
