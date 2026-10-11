import { describe, expect, it } from 'vitest';
import {
  formatShaderError,
  minifyGlsl,
  resolveIncludes,
  ShaderIncludeError,
} from '../../src/glsl/index.js';

const chunks = {
  'xtree/test/a': 'float a() { return 1.0; }\n',
  'xtree/test/b': '#include <xtree/test/a>\nfloat b() { return a(); }\n',
  'xtree/test/c':
    '#include <xtree/test/a>\n#include <xtree/test/b>\nfloat c() { return b(); }\n',
};

describe('resolveIncludes', () => {
  it('expands includes once, at the first include', () => {
    const { code, files } = resolveIncludes(
      '#include <xtree/test/c>\n#include <xtree/test/a>\nvoid main() {}',
      chunks,
      { lineDirectives: false },
    );
    expect(code.match(/float a\(\)/g)).toHaveLength(1);
    expect(code.indexOf('float a()')).toBeLessThan(code.indexOf('float b()'));
    expect(code.indexOf('float b()')).toBeLessThan(code.indexOf('float c()'));
    expect(files).toEqual([
      'shader',
      'xtree/test/c',
      'xtree/test/a',
      'xtree/test/b',
    ]);
  });

  it('keeps the root line count when a repeated include is dropped', () => {
    const source =
      '#include <xtree/test/a>\n#include <xtree/test/a>\nvoid main() {}';
    const { code } = resolveIncludes(source, chunks, { lineDirectives: false });
    expect(code.split('\n')).toEqual([
      'float a() { return 1.0; }',
      '',
      'void main() {}',
    ]);
  });

  it('emits #line directives that map back to each source string', () => {
    const { code, files } = resolveIncludes(
      '// root\n#include <xtree/test/b>\nvoid main() {}',
      chunks,
      {
        name: 'effects/test.glsl',
      },
    );
    expect(files).toEqual([
      'effects/test.glsl',
      'xtree/test/b',
      'xtree/test/a',
    ]);
    expect(code.split('\n')).toEqual([
      '// root',
      '#line 1 1',
      '#line 1 2',
      'float a() { return 1.0; }',
      '#line 2 1',
      'float b() { return a(); }',
      '#line 3 0',
      'void main() {}',
    ]);
  });

  it('leaves non-xtree includes for three.js', () => {
    const { code } = resolveIncludes(
      '#include <common>\n#include <xtree/test/a>',
      chunks,
      {
        lineDirectives: false,
      },
    );
    expect(code).toBe('#include <common>\nfloat a() { return 1.0; }');
  });

  it('accepts several chunk maps, later maps taking precedence', () => {
    const { code } = resolveIncludes(
      '#include <xtree/test/a>',
      [chunks, { 'xtree/test/a': 'override' }],
      {
        lineDirectives: false,
      },
    );
    expect(code).toBe('override');
  });

  it('rejects unknown xtree chunks with the including file and line', () => {
    expect(() =>
      resolveIncludes('\n#include <xtree/missing>', chunks, { name: 'root' }),
    ).toThrow(new ShaderIncludeError('root:2: unknown chunk <xtree/missing>'));
  });

  it('rejects include cycles', () => {
    const cyclic = {
      'xtree/x': '#include <xtree/y>',
      'xtree/y': '#include <xtree/x>',
    };
    expect(() => resolveIncludes('#include <xtree/x>', cyclic)).toThrow(
      /include cycle: shader -> xtree\/x -> xtree\/y -> xtree\/x/,
    );
  });

  it('ignores includes that are commented out or indented after code', () => {
    const { code } = resolveIncludes(
      '// #include <xtree/test/a>\n  #include <xtree/test/a> // note',
      chunks,
      {
        lineDirectives: false,
      },
    );
    expect(code).toBe('// #include <xtree/test/a>\nfloat a() { return 1.0; }');
  });
});

describe('formatShaderError', () => {
  it('names the chunk for each diagnostic', () => {
    const log =
      "ERROR: 2:15: 'foo' : undeclared identifier\nWARNING: 0:3: unused\nERROR: 2 compilation errors.";
    expect(
      formatShaderError(log, [
        'effects/test.glsl',
        'xtree/test/b',
        'xtree/test/a',
      ]),
    ).toBe(
      "ERROR: xtree/test/a:15: 'foo' : undeclared identifier\nWARNING: effects/test.glsl:3: unused\nERROR: 2 compilation errors.",
    );
  });

  it('falls back to the source number for unknown indices', () => {
    expect(formatShaderError('ERROR: 9:1: bad', ['root'])).toBe(
      'ERROR: source 9:1: bad',
    );
  });
});

describe('minifyGlsl', () => {
  const source = [
    '/**',
    ' * Header',
    ' */',
    '#define XT_F(x) ((x) * 2.0)',
    '#define XT_G (1.0)',
    'float   xt_f(float v) {   // comment',
    '\treturn XT_F(v) /* inline */ + XT_G;',
    '}',
    '',
    '',
  ].join('\n');

  it('preserves line numbers', () => {
    expect(minifyGlsl(source).split('\n')).toHaveLength(
      source.split('\n').length - 1,
    );
  });

  it('removes comments and indentation but keeps macro forms', () => {
    expect(minifyGlsl(source)).toBe(
      [
        '',
        '',
        '',
        '#define XT_F(x) ((x) * 2.0)',
        '#define XT_G (1.0)',
        'float xt_f(float v) {',
        'return XT_F(v) + XT_G;',
        '}',
        '',
      ].join('\n'),
    );
  });
});
