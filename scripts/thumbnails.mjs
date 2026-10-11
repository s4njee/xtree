// Effect thumbnails for the docs (X19.14, X19.16): each effect's still on the
// studio scene, which the visual tests render with Playwright and keep as the
// Chromium baseline `<effect>-default.png`. Copies them to
// docs/public/thumbnails/<effect>.png, writing only files whose content
// changed (a baseline changes only when the effect's output does).
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselines = join(
  root,
  'packages/xtree/test/browser/__baselines__/chromium',
);
const out = join(root, 'docs/public/thumbnails');
mkdirSync(out, { recursive: true });

const effects = readdirSync(join(root, 'packages/xtree/src/effects'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
let written = 0;
for (const id of effects) {
  const source = join(baselines, `${id}-default.png`);
  if (!existsSync(source)) throw new Error(`no baseline for ${id}`);
  const target = join(out, `${id}.png`);
  const data = readFileSync(source);
  if (existsSync(target) && readFileSync(target).equals(data)) continue;
  writeFileSync(target, data);
  written++;
}
console.log(
  `Thumbnails: ${effects.length} effects, ${written} updated in docs/public/thumbnails.`,
);
