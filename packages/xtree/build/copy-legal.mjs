// Copies the repository licence and third-party notices into the package before packing.
import { copyFileSync } from 'node:fs';

for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  copyFileSync(
    new URL(`../../../${file}`, import.meta.url),
    new URL(`../${file}`, import.meta.url),
  );
}
