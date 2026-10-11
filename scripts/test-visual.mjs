// Runs the visual regression tests (X18.3). `--update` rewrites the running
// browser's baselines that are missing or no longer match, in
// packages/xtree/test/browser/__baselines__/<browser>/; `--update=all`
// rewrites every one. Other arguments go to Playwright, for example
// `XT_BROWSERS=firefox pnpm test:visual --update` or a `-g` filter.
import { spawnSync } from 'node:child_process';

const args = process.argv
  .slice(2)
  .map((arg) =>
    arg === '--update'
      ? '--update-snapshots=changed'
      : arg === '--update=all'
        ? '--update-snapshots=all'
        : arg,
  );
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'playwright',
    'test',
    'packages/xtree/test/browser/visual.spec.ts',
    ...args,
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
