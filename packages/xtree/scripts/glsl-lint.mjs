// Lints the GLSL chunk library: conventions, documentation, includes and, when
// glslangValidator is installed, a real GLSL ES 3.00 compile of every chunk.
// Set XT_REQUIRE_GLSLANG=1 (CI does) to fail when the validator is missing.
import { execFileSync, spawnSync } from 'node:child_process';
import { loadGlslTools, parseChunk, readChunks } from './lib.mjs';

const chunks = readChunks();
const ids = new Set(chunks.map((chunk) => chunk.id));
const map = Object.fromEntries(chunks.map((chunk) => [chunk.id, chunk.source]));
const { resolveIncludes, formatShaderError } = await loadGlslTools();
const problems = [];
const report = (chunk, line, message) =>
  problems.push(`${chunk.file}:${line}: ${message}`);

const typeWords =
  /^(?:const\s+)?(?:(?:highp|mediump|lowp)\s+)?(void|bool|int|uint|float|[biu]?vec[234]|mat[234](?:x[234])?|sampler\w+|struct)\s+([A-Za-z_]\w*)/;

for (const chunk of chunks) {
  const { source } = chunk;
  const lines = source.split('\n');
  if (!source.startsWith('/**'))
    report(chunk, 1, 'chunk must start with a /** description */ header');
  if (!source.endsWith('\n') || source.endsWith('\n\n'))
    report(chunk, lines.length, 'file must end with exactly one newline');
  if (source.includes('\r')) report(chunk, 1, 'use LF line endings');
  lines.forEach((line, index) => {
    const n = index + 1;
    if (line.includes('\t')) report(chunk, n, 'use spaces, not tabs');
    if (/\s$/.test(line)) report(chunk, n, 'trailing whitespace');
    if (/^\s*#\s*(version|extension)\b/.test(line))
      report(chunk, n, '#version and #extension belong to the host shader');
    if (/^\s*precision\s/.test(line))
      report(chunk, n, 'precision statements belong to the host shader');
    const define = /^#define\s+(\w+)/.exec(line);
    if (define && !define[1].startsWith('XT_'))
      report(chunk, n, `macro ${define[1]} must start with XT_`);
    const declaration = typeWords.exec(line);
    if (declaration && !/^(xt_|XT_)/.test(declaration[2])) {
      report(
        chunk,
        n,
        `top-level name ${declaration[2]} must start with xt_ (or XT_ for constants)`,
      );
    }
    const include = /^\s*#\s*include\s+<([^>]+)>/.exec(line);
    if (include) {
      if (include[1] === chunk.id) report(chunk, n, 'chunk includes itself');
      else if (!ids.has(include[1]))
        report(chunk, n, `unknown chunk <${include[1]}>`);
    }
  });
  const seen = new Set();
  for (const fn of parseChunk(source).functions) {
    if (!seen.has(fn.name) && !fn.doc)
      report(
        chunk,
        fn.line,
        `${fn.name} needs a /// description on its first definition`,
      );
    seen.add(fn.name);
  }
}

const validator = spawnSync('glslangValidator', ['--version'], {
  encoding: 'utf8',
});
const hasValidator = validator.status === 0;
if (hasValidator) {
  for (const chunk of chunks) {
    let resolved;
    try {
      resolved = resolveIncludes(`#include <${chunk.id}>`, map, {
        name: 'lint',
      });
    } catch (error) {
      report(chunk, 1, error.message);
      continue;
    }
    const prelude =
      '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;';
    const unit = `${prelude}\n${resolved.code}\nout vec4 xt_lintOutput;\nvoid main() { xt_lintOutput = vec4(0.0); }\n`;
    try {
      execFileSync('glslangValidator', ['--stdin', '-S', 'frag'], {
        input: unit,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      const log = formatShaderError(
        `${error.stdout ?? ''}${error.stderr ?? ''}`,
        resolved.files,
      );
      problems.push(`${chunk.file}: glslangValidator failed\n${log.trim()}`);
    }
  }
} else if (process.env.XT_REQUIRE_GLSLANG === '1') {
  problems.push(
    'glslangValidator is required (XT_REQUIRE_GLSLANG=1) but was not found on PATH',
  );
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `GLSL lint: ${chunks.length} chunks pass${hasValidator ? ' (compiled with glslangValidator)' : ' (glslangValidator not installed; compile step skipped)'}.`,
);
