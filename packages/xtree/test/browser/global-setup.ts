import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Where the GLSL lint writes every effect variant for the compile tests (X18.2). */
export const variantsFile = fileURLToPath(
  new URL('../../../../.cache/xtree/variants.json', import.meta.url),
);

export default function globalSetup(): void {
  // Each coverage run starts empty (see coverage.ts).
  if (process.env.XT_COVERAGE === '1')
    rmSync(new URL('../../../../.cache/xtree/coverage/', import.meta.url), {
      recursive: true,
      force: true,
    });
  mkdirSync(new URL('../../../../.cache/xtree/', import.meta.url), {
    recursive: true,
  });
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../scripts/glsl-lint.mjs', import.meta.url)),
      '--emit',
      variantsFile,
    ],
    { stdio: 'inherit' },
  );
}
