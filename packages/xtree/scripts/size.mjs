// Measures what a consumer ships for each package export: the built entry is
// bundled the way an application bundler would (tree-shaken and minified, with
// the three.js peer external), then gzipped. Fails when an export has no
// budget or goes over it. Writes artifacts/size.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { packageRoot, repoRoot } from './lib.mjs';

const pkg = JSON.parse(readFileSync(`${packageRoot}package.json`, 'utf8'));
const budgets = JSON.parse(
  readFileSync(`${packageRoot}size-budgets.json`, 'utf8'),
);
async function bundle(entry) {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      target: 'es2022',
      lib: { entry, formats: ['es'], fileName: 'entry' },
      rolldownOptions: { external: [/^three(\/.*)?$/] },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => r.output,
  );
  return outputs.filter((o) => o.type === 'chunk').map((o) => o.code);
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
  const source = (await bundle(file)).join('\n');
  const gzip = gzipSync(source, { level: 9 }).length;
  const budget = budgets[key];
  results.push({
    export: key,
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
    `${r.export.padEnd(width)}  ${String(r.gzip).padStart(6)} B gzip / ${r.budget ?? '—'} B budget`,
  );
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
