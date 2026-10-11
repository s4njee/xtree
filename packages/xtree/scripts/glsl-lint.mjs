// Lints the GLSL in the package:
// - chunks: conventions, documentation, includes;
// - effects: every $name is declared, helpers are namespaced;
// and, when glslangValidator is installed, compiles every chunk, every
// effect's merged pass (each structural variant and preset, two copies merged
// to catch name clashes) and every standalone shader as GLSL ES 3.00.
// Set XT_REQUIRE_GLSLANG=1 (CI does) to fail when the validator is missing.
// With `--emit <file>`, writes every effect variant's shaders to a JSON file
// instead of validating them, for the browser compile tests (X18.2).
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const emitIndex = process.argv.indexOf('--emit');
const emitPath = emitIndex === -1 ? null : process.argv[emitIndex + 1];
if (emitIndex !== -1 && !emitPath) throw new Error('--emit needs a file path');
/** Shaders to emit: { name, stage, source }. Shaders with the same name link together. */
const emitted = [];
const hasValidator =
  !emitPath &&
  spawnSync('glslangValidator', ['--version'], { encoding: 'utf8' }).status ===
    0;
if (!hasValidator && !emitPath && process.env.XT_REQUIRE_GLSLANG === '1') {
  problems.push(
    'glslangValidator is required (XT_REQUIRE_GLSLANG=1) but was not found on PATH',
  );
}
/** Returns the validator log on failure, null on success or when the validator is missing. */
const validate = (source, stage = 'frag', name = '') => {
  if (emitPath && name) emitted.push({ name, stage, source });
  if (!hasValidator) return null;
  try {
    execFileSync('glslangValidator', ['--stdin', '-S', stage], {
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
const { compileMaterial } = await loadSource('src/core/material-compile.ts');
const { compileTransition, compileHoloFragment } = await loadSource(
  'src/core/transition-compile.ts',
);

// What three.js puts around a ShaderMaterial fragment on WebGL2, as HoloCSS's transition3d() uses it.
const holoFragment = (code) => `#version 300 es
precision highp float;
precision highp int;
#define varying in
#define texture2D texture
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
vec4 sRGBTransferOETF(vec4 v) { return v; }
${code.replace('#include <colorspace_fragment>', 'gl_FragColor = sRGBTransferOETF(gl_FragColor);')}
`;

// Stand-ins for the prefixes three.js puts in front of a built-in material's shaders.
const materialVertex = (code) => `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
#define varying out
in vec3 position;
in vec3 normal;
in vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
out vec3 vNormal;
${code.vertexPars}
void main() {
  vec3 transformed = position;
${code.vertexBeforeProject}
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
${code.vertexAfterProject}
}
`;
const materialFragment = (code) => `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
uniform bool isOrthographic;
${code.fragmentPars}
void main() {
  vec3 normal = vec3(0.0, 0.0, 1.0);
  gl_FragColor = vec4(1.0);
${code.fragmentMain}
}
`;
let variants = 0;
for (const { id, factory } of effects) {
  const { definition } = factory;
  const folder = `src/effects/${id}`;
  const material = definition.kind === 'material';
  const transition = definition.kind === 'transition';
  const sources = [definition.fragment, definition.vertex ?? ''].join('\n');
  const known = new Set([
    'main',
    'fragment',
    'vertex',
    'transition',
    'time',
    'maskAt',
    'has_mask',
    'maskKind',
    ...Object.keys(definition.params),
    ...(definition.textures ?? []),
    ...Object.keys(definition.state ?? {}),
  ]);
  for (const [name, param] of Object.entries(definition.params)) {
    if (param.kind === 'select')
      for (const option of param.options)
        known.add(`${name}_${option.replace(/\W+/g, '_')}`);
    if (param.kind === 'texture') known.add(`has_${name}`);
  }
  for (const [, fn] of sources.matchAll(/\b\w+\s+\$(\w+)\s*\(/g)) known.add(fn);
  // Names an effect defines itself: `#define $NAME` and `const type $name`.
  for (const [, defined] of sources.matchAll(/#define\s+\$(\w+)/g))
    known.add(defined);
  for (const [, constant] of sources.matchAll(/\bconst\s+\w+\s+\$(\w+)/g))
    known.add(constant);
  for (const [, used] of sources.matchAll(/\$(\w+)/g)) {
    if (!known.has(used))
      problems.push(
        `${folder}: $${used} is not a parameter, texture, option constant or $function`,
      );
  }
  // X16.2: anything that reads time declares what it does when motion is off.
  if (
    /\bxt_time\b|\$time\b/.test(sources) &&
    (definition.motion ?? 'static') === 'static' &&
    !transition
  )
    problems.push(
      `${folder}: reads time but declares no motion behavior (freeze or settle)`,
    );
  if (/^\s*(?!return\b)\w+\s+xt_\w+\s*\(/m.test(sources)) {
    problems.push(
      `${folder}: helper functions in effects must use $names so merged copies don't clash`,
    );
  }
  const settings = [{}];
  for (const [name, param] of Object.entries(definition.params)) {
    if (param.kind === 'texture') {
      // Compile both with and without the texture.
      settings.push({
        [name]: param.default === null ? { isTexture: true } : null,
      });
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
  if (!material && !transition)
    settings.push(
      { mask: { texture: { isTexture: true }, channel: 'a' } },
      { mask: { depth: [1, 10], feather: 1 } },
      { mask: { selection: { layer: 1 } } },
    );
  for (const setting of material ? settings : []) {
    for (const lit of [true, false]) {
      const code = compileMaterial([factory(setting), factory(setting)], {
        lit,
      });
      variants++;
      for (const [stage, source] of [
        ['vert', materialVertex(code)],
        ['frag', materialFragment(code)],
      ]) {
        const log = validate(
          source,
          stage,
          `${id} ${JSON.stringify(setting)} ${lit ? 'lit' : 'unlit'}`,
        );
        if (log)
          problems.push(
            `${folder} ${JSON.stringify(setting)} ${lit ? 'lit' : 'unlit'} ${stage}: glslangValidator failed\n${log.trim()}`,
          );
      }
    }
  }
  for (const setting of transition ? settings : []) {
    for (const srgb of [true, false]) {
      const compiled = compileTransition(factory(setting), { srgb });
      variants++;
      const log = validate(
        `#version 300 es\n${compiled.fragment}`,
        'frag',
        `${id} ${JSON.stringify(setting)} ${srgb ? 'srgb' : 'linear'}`,
      );
      if (log)
        problems.push(
          `${folder} ${JSON.stringify(setting)}: glslangValidator failed\n${formatShaderError(log, compiled.files).trim()}`,
        );
    }
    const textured = Object.entries(definition.params).some(
      ([name, param]) =>
        param.kind === 'texture' && factory(setting).get(name) !== null,
    );
    if (textured) continue;
    variants++;
    const log = validate(
      holoFragment(compileHoloFragment(factory(setting))),
      'frag',
      `${id} ${JSON.stringify(setting)} HoloCSS`,
    );
    if (log)
      problems.push(
        `${folder} ${JSON.stringify(setting)} HoloCSS: glslangValidator failed\n${log.trim()}`,
      );
  }
  for (const setting of material || transition ? [] : settings) {
    const pass = compilePass([factory(setting), factory(setting)], {
      toneMapping: 'aces',
      colorSpace: 'srgb',
      dither: true,
    });
    variants++;
    const log = validate(
      `#version 300 es\n${pass.fragment}`,
      'frag',
      `${id} ${JSON.stringify(setting)}`,
    );
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
    // Standalone passes resolve their includes in setup (context.include).
    const resolved = resolveIncludes(source, map, {
      name: file,
      lineDirectives: false,
    }).code;
    const log = validate(
      `#version 300 es\n${resolved}`,
      'frag',
      `${id} ${file}`,
    );
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
if (emitPath) {
  writeFileSync(emitPath, JSON.stringify(emitted));
  console.log(`GLSL lint: wrote ${emitted.length} shaders to ${emitPath}.`);
  process.exit(0);
}
console.log(
  `GLSL lint: ${chunks.length} chunks and ${effects.length} effects (${variants} merged variants) pass${
    hasValidator
      ? ', compiled with glslangValidator'
      : '; glslangValidator is not installed, so nothing was compiled'
  }.`,
);
