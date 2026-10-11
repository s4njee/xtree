// Lints the GLSL in the package:
// - chunks: conventions, documentation, includes;
// - effects: every $name is declared, helpers are namespaced;
// and, when glslangValidator is installed, compiles every chunk, every
// effect's merged pass (each structural variant and preset, two copies merged
// to catch name clashes) and every standalone shader as GLSL ES 3.00.
// Set XT_REQUIRE_GLSLANG=1 (CI does) to fail when the validator is missing.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import {
  loadEffects,
  loadGlslTools,
  loadSource,
  packageRoot,
  parseChunk,
  readChunks,
} from './lib.mjs';

const chunks = readChunks();
const ids = new Set(chunks.map((chunk) => chunk.id));
const map = Object.fromEntries(chunks.map((chunk) => [chunk.id, chunk.source]));
const { resolveIncludes, formatShaderError } = await loadGlslTools();
const problems = [];
const report = (chunk, line, message) =>
  problems.push(`${chunk.file}:${line}: ${message}`);

const hasValidator =
  spawnSync('glslangValidator', ['--version'], { encoding: 'utf8' }).status ===
  0;
if (!hasValidator && process.env.XT_REQUIRE_GLSLANG === '1') {
  problems.push(
    'glslangValidator is required (XT_REQUIRE_GLSLANG=1) but was not found on PATH',
  );
}
/** Returns the validator log on failure, null on success or when the validator is missing. */
const validate = (source) => {
  if (!hasValidator) return null;
  try {
    execFileSync('glslangValidator', ['--stdin', '-S', 'frag'], {
      input: source,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return null;
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
};

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
  {
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
    const log = validate(
      `${prelude}\n${resolved.code}\nout vec4 xt_lintOutput;\nvoid main() { xt_lintOutput = vec4(0.0); }\n`,
    );
    if (log)
      problems.push(
        `${chunk.file}: glslangValidator failed\n${formatShaderError(log, resolved.files).trim()}`,
      );
  }
}

const effects = await loadEffects();
const { compilePass } = await loadSource('src/core/compile.ts');
let variants = 0;
for (const { id, factory } of effects) {
  const { definition } = factory;
  const folder = `src/effects/${id}`;
  const known = new Set([
    'main',
    'maskAt',
    'has_mask',
    'maskKind',
    ...Object.keys(definition.params),
    ...(definition.textures ?? []),
  ]);
  for (const [name, param] of Object.entries(definition.params)) {
    if (param.kind === 'select')
      for (const option of param.options)
        known.add(`${name}_${option.replace(/\W+/g, '_')}`);
    if (param.kind === 'texture') known.add(`has_${name}`);
  }
  for (const [, fn] of definition.fragment.matchAll(/\b\w+\s+\$(\w+)\s*\(/g))
    known.add(fn);
  for (const [, used] of definition.fragment.matchAll(/\$(\w+)/g)) {
    if (!known.has(used))
      problems.push(
        `${folder}: $${used} is not a parameter, texture, option constant or $function`,
      );
  }
  if (/^\s*(?!return\b)\w+\s+xt_\w+\s*\(/m.test(definition.fragment)) {
    problems.push(
      `${folder}: helper functions in effects must use $names so merged copies don't clash`,
    );
  }
  const settings = [{}];
  for (const [name, param] of Object.entries(definition.params)) {
    if (param.kind === 'texture') {
      settings.push({ [name]: null });
      continue;
    }
    if (!param.structural) continue;
    const values =
      param.kind === 'select'
        ? param.options
        : param.kind === 'bool'
          ? [true, false]
          : [param.min, param.max];
    for (const value of values) settings.push({ [name]: value });
  }
  for (const preset of Object.keys(definition.presets ?? {}))
    settings.push({ preset });
  // Every mask kind, which also adds the depth buffer for depth masks.
  settings.push(
    { mask: { texture: { isTexture: true }, channel: 'a' } },
    { mask: { depth: [1, 10], feather: 1 } },
    { mask: { selection: { layer: 1 } } },
  );
  for (const setting of settings) {
    const pass = compilePass([factory(setting), factory(setting)], {
      toneMapping: 'aces',
      colorSpace: 'srgb',
      dither: true,
    });
    variants++;
    const log = validate(`#version 300 es\n${pass.fragment}`);
    if (log)
      problems.push(
        `${folder} ${JSON.stringify(setting)}: glslangValidator failed\n${formatShaderError(log, pass.files).trim()}`,
      );
  }
  for (const file of readdirSync(`${packageRoot}${folder}`).filter((f) =>
    f.endsWith('.glsl'),
  )) {
    const source = readFileSync(`${packageRoot}${folder}/${file}`, 'utf8');
    if (!/void\s+main\s*\(/.test(source)) continue;
    const log = validate(`#version 300 es\n${source}`);
    if (log)
      problems.push(
        `${folder}/${file}: glslangValidator failed\n${log.trim()}`,
      );
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(
  `GLSL lint: ${chunks.length} chunks and ${effects.length} effects (${variants} merged variants) pass${
    hasValidator
      ? ', compiled with glslangValidator'
      : '; glslangValidator is not installed, so nothing was compiled'
  }.`,
);
