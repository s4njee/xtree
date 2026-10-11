// Merges the line coverage that `pnpm test:coverage` collects in Chromium
// (test/browser/coverage.ts) and reports it per file and folder. Writes
// artifacts/coverage.json. With --check, fails when src/core is below 90%.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const dir = new URL('.cache/xtree/coverage/', root);
const threshold = { 'src/core': 90 };

const merged = {};
let runs = 0;
for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  runs++;
  const data = JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
  for (const [file, lines] of Object.entries(data)) {
    const target = (merged[file] ??= {});
    for (const [line, ran] of Object.entries(lines))
      target[line] = target[line] === 1 ? 1 : ran;
  }
}
if (!runs) {
  console.error('No coverage found; run `pnpm test:coverage`.');
  process.exit(1);
}

const files = Object.entries(merged)
  .map(([file, lines]) => {
    const values = Object.values(lines);
    const covered = values.filter((v) => v === 1).length;
    const missed = Object.entries(lines)
      .filter(([, v]) => v === 0)
      .map(([line]) => Number(line))
      .sort((a, b) => a - b);
    return { file, lines: values.length, covered, missed };
  })
  .sort((a, b) => a.file.localeCompare(b.file));

const folders = {};
for (const f of files) {
  const folder = f.file.split('/').slice(0, 2).join('/');
  const entry = (folders[folder] ??= { lines: 0, covered: 0 });
  entry.lines += f.lines;
  entry.covered += f.covered;
}
const pct = (covered, lines) => (lines ? (100 * covered) / lines : 100);
/** Compresses [1,2,3,7] to "1-3, 7". */
const spans = (lines) => {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let j = i;
    while (lines[j + 1] === lines[j] + 1) j++;
    out.push(i === j ? `${lines[i]}` : `${lines[i]}-${lines[j]}`);
    i = j;
  }
  return out.join(', ');
};

console.log(`Line coverage from ${runs} Chromium pages\n`);
for (const f of files.filter((f) => f.file.startsWith('src/core/')))
  console.log(
    `${f.file.padEnd(36)} ${pct(f.covered, f.lines).toFixed(1).padStart(5)}%  ${f.missed.length ? `missed ${spans(f.missed)}` : ''}`,
  );
console.log('');
for (const [folder, { lines, covered }] of Object.entries(folders).sort())
  console.log(
    `${folder.padEnd(36)} ${pct(covered, lines).toFixed(1).padStart(5)}%  (${covered}/${lines} lines)`,
  );

mkdirSync(new URL('artifacts/', root), { recursive: true });
writeFileSync(
  new URL('artifacts/coverage.json', root),
  `${JSON.stringify({ folders, files }, null, 2)}\n`,
);
console.log(
  `\nWrote ${fileURLToPath(new URL('artifacts/coverage.json', root))}`,
);

if (process.argv.includes('--check')) {
  const failures = Object.entries(threshold).filter(([folder, min]) => {
    const entry = folders[folder];
    return !entry || pct(entry.covered, entry.lines) < min;
  });
  for (const [folder, min] of failures)
    console.error(`${folder} line coverage is below ${min}%`);
  if (failures.length) process.exit(1);
}
