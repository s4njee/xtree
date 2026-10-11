// Keeps package.json "exports" in sync with the build entries (one export per
// effect folder). With --check, fails when they differ.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadSource, packageRoot } from './lib.mjs';

const { entries } = await loadSource('build/entries.ts');
const pkgPath = `${packageRoot}package.json`;
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const exports = {};
for (const name of Object.keys(entries).sort((a, b) =>
  a === 'index' ? -1 : b === 'index' ? 1 : a.localeCompare(b),
)) {
  const key = name === 'index' ? '.' : `./${name.replace(/\/index$/, '')}`;
  exports[key] = { types: `./dist/${name}.d.ts`, import: `./dist/${name}.js` };
}
exports['./package.json'] = './package.json';
const next = { ...pkg, exports };
const text = `${JSON.stringify(next, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(pkgPath, 'utf8') !== text) {
    console.error('package.json exports are out of date; run `pnpm exports`.');
    process.exit(1);
  }
  console.log(
    `Exports are up to date (${Object.keys(exports).length - 1} entries).`,
  );
} else {
  writeFileSync(pkgPath, text);
  console.log(
    `Wrote ${Object.keys(exports).length - 1} exports to package.json.`,
  );
}
