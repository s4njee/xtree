import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageRoot = new URL('../../', import.meta.url);
const pkg = JSON.parse(
  readFileSync(new URL('package.json', packageRoot), 'utf8'),
) as {
  exports: Record<string, string | { import: string }>;
};

// A resolve hook that fails any attempt to load the three.js peer.
const hook = `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === 'three' || specifier.startsWith('three/')) throw new Error('loaded peer: ' + specifier);
  return next(specifier, context);
}`)}`;

describe('Node imports', () => {
  const entries = Object.entries(pkg.exports).filter(
    ([key]) => key !== './package.json',
  );

  it('has a built dist/ (run `pnpm build` first)', () => {
    expect(existsSync(new URL('dist/index.js', packageRoot))).toBe(true);
  });

  for (const [key, target] of entries) {
    const file = typeof target === 'string' ? target : target.import;
    it(`imports ${key} without a DOM or the three peer`, () => {
      const script = `
        import { register } from 'node:module';
        register(${JSON.stringify(hook)});
        await import(${JSON.stringify(new URL(file, packageRoot).href)});
        if (typeof document !== 'undefined' || typeof window !== 'undefined') throw new Error('touched a DOM global');
      `;
      expect(() =>
        execFileSync(process.execPath, ['--input-type=module', '-e', script], {
          stdio: 'pipe',
        }),
      ).not.toThrow();
    });
  }
});
