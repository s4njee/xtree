// Packs @mk7s/xtree into artifacts/ and checks the tarball against the export
// map: every export target and declaration file must be inside, and nothing
// from src/, test/ or scripts/ may leak in.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkgDir = resolve(root, 'packages/xtree');
const artifacts = resolve(root, 'artifacts');
mkdirSync(artifacts, { recursive: true });
execFileSync('pnpm', ['pack', '--pack-destination', artifacts], {
  cwd: pkgDir,
  stdio: 'inherit',
});
const pkg = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8'));
const tarball = readdirSync(artifacts).find(
  (f) => f === `mk7s-xtree-${pkg.version}.tgz`,
);
if (!tarball) throw new Error('pack produced no tarball');
const files = new Set(
  execFileSync('tar', ['-tzf', resolve(artifacts, tarball)], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(/^package\//, '')),
);
const problems = [];
for (const [key, target] of Object.entries(pkg.exports)) {
  for (const file of typeof target === 'string'
    ? [target]
    : Object.values(target)) {
    if (!files.has(file.replace(/^\.\//, '')))
      problems.push(`${key}: ${file} is not in the tarball`);
  }
}
for (const required of [
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  'README.md',
  'package.json',
]) {
  if (!files.has(required)) problems.push(`${required} is not in the tarball`);
}
for (const file of files) {
  if (/^(src|test|scripts|build)\//.test(file))
    problems.push(`${file} should not be published`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `release:dry: artifacts/${tarball} has ${files.size} files and matches the export map.`,
);
