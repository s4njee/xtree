// Measures the gzip size of each package export, including the local modules
// it imports (its dependency closure) and excluding the three.js peer. Fails
// when an export has no budget or goes over it. Writes artifacts/size.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { packageRoot, repoRoot } from './lib.mjs';

const pkg = JSON.parse(readFileSync(`${packageRoot}package.json`, 'utf8'));
const budgets = JSON.parse(
  readFileSync(`${packageRoot}size-budgets.json`, 'utf8'),
);
const importPattern =
  /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;

function closure(entry) {
  const files = new Set();
  const visit = (file) => {
    if (files.has(file)) return;
    files.add(file);
    const code = readFileSync(file, 'utf8');
    for (const [, specifier] of code.matchAll(importPattern))
      visit(resolve(dirname(file), specifier));
  };
  visit(entry);
  return [...files];
}

const results = [];
const problems = [];
for (const [key, target] of Object.entries(pkg.exports)) {
  if (key === './package.json') continue;
  const file = resolve(
    packageRoot,
    typeof target === 'string' ? target : target.import,
  );
  if (!existsSync(file)) {
    problems.push(`${key}: ${file} is missing; run pnpm build first`);
    continue;
  }
  const files = closure(file);
  const source = files
    .map((f) =>
      readFileSync(f, 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, ''),
    )
    .join('\n');
  const gzip = gzipSync(source, { level: 9 }).length;
  const budget = budgets[key];
  results.push({
    export: key,
    files: files.length,
    raw: Buffer.byteLength(source),
    gzip,
    budget: budget ?? null,
  });
  if (budget === undefined)
    problems.push(`${key}: no budget in size-budgets.json`);
  else if (gzip > budget)
    problems.push(`${key}: ${gzip} B gzip is over its ${budget} B budget`);
}
for (const key of Object.keys(budgets)) {
  if (!(key in pkg.exports))
    problems.push(`size-budgets.json: ${key} is not a package export`);
}

mkdirSync(`${repoRoot}artifacts`, { recursive: true });
writeFileSync(
  `${repoRoot}artifacts/size.json`,
  `${JSON.stringify(results, null, 2)}\n`,
);
const width = Math.max(...results.map((r) => r.export.length));
for (const r of results) {
  console.log(
    `${r.export.padEnd(width)}  ${String(r.gzip).padStart(6)} B gzip / ${r.budget ?? '—'} B budget  (${r.files} file${r.files === 1 ? '' : 's'})`,
  );
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
