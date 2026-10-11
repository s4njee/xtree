// Effect thumbnails for the docs (X19.14, X19.16): each effect's still on the
// studio scene, which the visual tests render with Playwright and keep as the
// Chromium baseline `<effect>-default.png`. Copies them to
// docs/public/thumbnails/<effect>.png, but only for effects whose hash
// changed: the hash covers the effect's source folder and the studio scene,
// and docs/public/thumbnails/manifest.json keeps the last one.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
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
const manifestFile = join(out, 'manifest.json');
const manifest = existsSync(manifestFile)
  ? JSON.parse(readFileSync(manifestFile, 'utf8'))
  : {};
const scene = readFileSync(join(root, 'packages/scenes/src/index.ts'));
/** A hash of what an effect's still depends on: its own source files and the studio scene. */
function effectHash(id) {
  const hash = createHash('sha256').update(scene);
  const folder = join(root, 'packages/xtree/src/effects', id);
  for (const file of readdirSync(folder).sort())
    hash.update(file).update(readFileSync(join(folder, file)));
  return hash.digest('hex').slice(0, 16);
}
let written = 0;
for (const id of effects) {
  const target = join(out, `${id}.png`);
  const hash = effectHash(id);
  if (manifest[id] === hash && existsSync(target)) continue;
  const source = join(baselines, `${id}-default.png`);
  if (!existsSync(source)) throw new Error(`no baseline for ${id}`);
  writeFileSync(target, readFileSync(source));
  manifest[id] = hash;
  written++;
}
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Thumbnails: ${effects.length} effects, ${written} updated in docs/public/thumbnails.`,
);
