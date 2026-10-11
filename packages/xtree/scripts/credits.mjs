// Checks provenance: every chunk has a credits entry, every licence is on the
// allow-list, and every derived or ported entry has a notice in
// THIRD_PARTY_NOTICES.md. See docs/adr/0006-licensing-and-credits.md.
import { readFileSync } from 'node:fs';
import { packageRoot, readChunks, readEffectIds, repoRoot } from './lib.mjs';

/** SPDX ids whose terms allow redistribution inside an MIT package. */
const allowed = new Set([
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  'Zlib',
  'CC0-1.0',
  'Unlicense',
  'public-domain',
]);
const kinds = new Set(['original', 'derived', 'ported']);

const { entries } = JSON.parse(
  readFileSync(`${packageRoot}credits.json`, 'utf8'),
);
const notices = readFileSync(`${repoRoot}THIRD_PARTY_NOTICES.md`, 'utf8');
const headings = new Set(
  [...notices.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()),
);
const chunkIds = new Set(readChunks().map((chunk) => chunk.id));
const effectIds = new Set(readEffectIds().map((id) => `effects/${id}`));
const problems = [];
const seen = new Set();

for (const entry of entries) {
  const where = `credits.json ${entry.id ?? '(missing id)'}`;
  if (seen.has(entry.id)) problems.push(`${where}: duplicate entry`);
  seen.add(entry.id);
  if (!kinds.has(entry.kind))
    problems.push(`${where}: kind must be one of ${[...kinds].join(', ')}`);
  if (/\b(NC|SA|ND)\b|GPL/i.test(entry.licence ?? '')) {
    problems.push(
      `${where}: ${entry.licence} is incompatible with an MIT package; reimplement from the paper instead`,
    );
  } else if (!allowed.has(entry.licence)) {
    problems.push(
      `${where}: licence ${entry.licence} is not on the allow-list (${[...allowed].join(', ')})`,
    );
  }
  if (!Array.isArray(entry.references) || entry.references.length === 0)
    problems.push(`${where}: list at least one reference`);
  const needed = [
    ...(entry.kind === 'original' ? [] : [entry.notice]),
    ...(entry.additionalNotices ?? []),
  ];
  if (entry.kind !== 'original' && !entry.notice)
    problems.push(`${where}: ${entry.kind} code needs a "notice" heading`);
  for (const notice of needed.filter(Boolean)) {
    if (!headings.has(notice))
      problems.push(
        `${where}: THIRD_PARTY_NOTICES.md has no "## ${notice}" section`,
      );
  }
  if (entry.id?.startsWith('xtree/') && !chunkIds.has(entry.id))
    problems.push(`${where}: no such chunk`);
  if (entry.id?.startsWith('effects/') && !effectIds.has(entry.id))
    problems.push(`${where}: no such effect`);
}
for (const id of [...chunkIds, ...effectIds])
  if (!seen.has(id)) problems.push(`credits.json: missing entry for ${id}`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `Credits: ${entries.length} entries, all licences allowed and notices present.`,
);
