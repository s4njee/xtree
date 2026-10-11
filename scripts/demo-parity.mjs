// Docs fixture parity (X18.5), the HoloCSS convention: every live demo in the
// docs is also a test fixture, and every fixture has a demo. A demo is an
// <EffectDemo effect="…"> on a docs page; its fixture is the effect's folder,
// which the GPU fixture page loads and the visual tests render on the same
// studio scene, with a committed `<effect>-default.png` baseline. Runs before
// the docs build and fails it on any mismatch.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
const effectsDir = join(root, 'packages/xtree/src/effects');
const baselines = join(root, 'packages/xtree/test/browser/__baselines__');

function* markdown(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* markdown(path);
    else if (entry.name.endsWith('.md')) yield path;
  }
}

/** Baseline file names in __baselines__ and any per-browser folder in it. */
function* baselineNames(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) yield* baselineNames(join(dir, entry.name));
    else yield entry.name;
  }
}

const demos = new Map();
for (const file of markdown(docs)) {
  const text = readFileSync(file, 'utf8');
  for (const [, id] of text.matchAll(/<EffectDemo\s[^>]*effect="([^"]+)"/g))
    demos.set(id, [...(demos.get(id) ?? []), relative(root, file)]);
}
const effects = readdirSync(effectsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const baselined = new Set(baselineNames(baselines));

const problems = [];
for (const [id, files] of demos) {
  if (!effects.includes(id))
    problems.push(`${files.join(', ')}: demo of "${id}" has no fixture`);
  if (files.length > 1)
    problems.push(`"${id}" has more than one demo: ${files.join(', ')}`);
}
for (const id of effects) {
  if (!demos.has(id)) problems.push(`effect "${id}" has no docs demo`);
  if (!baselined.has(`${id}-default.png`))
    problems.push(`effect "${id}" has no visual baseline (${id}-default.png)`);
}
if (problems.length) {
  console.error(`Docs fixture parity failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `Docs fixture parity: ${demos.size} demos, each with a fixture and a baseline.`,
);
