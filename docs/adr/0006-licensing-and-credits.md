# 0006 — Licensing and credits

Status: accepted, 2026-10-11.

## Context

Many well-known shader effects circulate as Shadertoy code under CC BY-NC-SA 3.0, which can't be redistributed in an MIT package. Others come from MIT or Apache-2.0 projects such as three.js and Filament, whose notices must ship with the code.

## Decision

- xtree is MIT licensed.
- `packages/xtree/credits.json` has one entry per shipped chunk (and, later, per effect, material and transition): its `kind` (`original`, `derived` or `ported`), the licence of the source it derives from, and references to the papers or projects it is based on.
- `pnpm credits` fails when a chunk has no entry, a licence is not on the allow-list (MIT, BSD-2/3-Clause, Apache-2.0, ISC, Zlib, CC0-1.0, Unlicense, public domain), a licence is NC, SA, ND or GPL, or a derived or ported entry has no matching section in `THIRD_PARTY_NOTICES.md`.
- Effects known only from restrictively licensed code are reimplemented from papers and descriptions, without reading or porting that code.
- `THIRD_PARTY_NOTICES.md` ships in the npm package. The shader reference prints each chunk's credits.

## Consequences

The tone-mapping chunk carries the three.js (MIT) and Filament (Apache-2.0) notices, and the OKLab matrices carry Björn Ottosson's MIT notice. Every other M0 chunk is an original implementation of a published technique.
