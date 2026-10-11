// Makes a HoloCSS source checkout available to the docs site.
//
// HoloCSS is not on npm yet, so the docs read its source at the commit pinned
// in holocss.json. By default the checkout lives in .cache/holocss. Set
// HOLOCSS_DIR to use an existing checkout instead (for example a sibling
// ../holocss while you work on both); a different commit there only warns.
// Prints the directory it resolved. See docs/adr/0005-holocss-relationship.md.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pin = JSON.parse(readFileSync(resolve(root, 'holocss.json'), 'utf8'));
const git = (cwd, ...args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

export function holocssDir() {
  return process.env.HOLOCSS_DIR
    ? resolve(process.env.HOLOCSS_DIR)
    : resolve(root, '.cache/holocss');
}

/** Files the docs import; a checkout without them is unusable. */
const required = [
  'src/css/tokens.css',
  'src/components/index.css',
  'src/theme/index.ts',
  'src/theme/bootstrap.ts',
];

export function ensureHolocss() {
  const dir = holocssDir();
  if (process.env.HOLOCSS_DIR) {
    if (!existsSync(dir)) throw new Error(`HOLOCSS_DIR=${dir} does not exist`);
    const head = git(dir, 'rev-parse', 'HEAD');
    if (head !== pin.commit)
      console.warn(
        `holocss: using ${dir} at ${head.slice(0, 7)} (pinned ${pin.commit.slice(0, 7)})`,
      );
  } else {
    if (!existsSync(resolve(dir, '.git'))) {
      mkdirSync(dir, { recursive: true });
      git(dir, 'init', '--quiet');
      git(dir, 'remote', 'add', 'origin', pin.repository);
    }
    const head = (() => {
      try {
        return git(dir, 'rev-parse', 'HEAD');
      } catch {
        return '';
      }
    })();
    if (head !== pin.commit) {
      console.log(
        `holocss: fetching ${pin.repository} at ${pin.commit.slice(0, 7)} into ${dir}`,
      );
      git(dir, 'fetch', '--quiet', '--depth', '1', 'origin', pin.commit);
      git(dir, 'checkout', '--quiet', '--detach', pin.commit);
    }
  }
  const missing = required.filter((file) => !existsSync(resolve(dir, file)));
  if (missing.length)
    throw new Error(
      `holocss checkout at ${dir} is missing ${missing.join(', ')}`,
    );
  return dir;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(`holocss: ready at ${ensureHolocss()}`);
}
