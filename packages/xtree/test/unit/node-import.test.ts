import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageRoot = new URL('../../', import.meta.url);
const pkg = JSON.parse(
  readFileSync(new URL('package.json', packageRoot), 'utf8'),
) as {
  exports: Record<string, string | { import: string }>;
};

// Only the composer entry may load the three.js peer; effects and shader
// entries must stay importable without it (ADR 0004).
const mayLoadThree = new Set(['./core']);

// Only the HoloCSS entry may import the optional HoloCSS peer (X15.1).
const mayLoadHolocss = new Set(['./holocss']);

// HoloCSS isn't on npm yet; its entry is imported against a stand-in runtime.
const holocssStub = `data:text/javascript,${encodeURIComponent(
  'export const motionAllowed = () => true; export const watchMotion = () => () => {};',
)}`;

/** A resolve hook that fails any attempt to load a peer the entry may not load. */
const hook = (three: boolean, holocss: boolean) =>
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (${!three} && (specifier === 'three' || specifier.startsWith('three/'))) throw new Error('loaded peer: ' + specifier);
  if (specifier === '@mk7s/holocss' || specifier.startsWith('@mk7s/holocss/')) {
    if (${!holocss}) throw new Error('loaded peer: ' + specifier);
    return { url: ${JSON.stringify(holocssStub)}, shortCircuit: true };
  }
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
    const allowThree = mayLoadThree.has(key);
    const allowHolocss = mayLoadHolocss.has(key);
    it(`imports ${key} without a DOM${allowThree ? '' : ' or the three peer'}${allowHolocss ? '' : ' or HoloCSS'}`, () => {
      const script = `
        import { register } from 'node:module';
        register(${JSON.stringify(hook(allowThree, allowHolocss))});
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

  it('references HoloCSS only from the HoloCSS entry', () => {
    const dist = new URL('dist/', packageRoot);
    const offenders = (
      readdirSync(dist, { recursive: true, encoding: 'utf8' }) as string[]
    ).filter(
      (file) =>
        file.endsWith('.js') &&
        !file.startsWith('holocss/') &&
        readFileSync(new URL(file, dist), 'utf8').includes('@mk7s/holocss'),
    );
    expect(offenders).toEqual([]);
  });
});
