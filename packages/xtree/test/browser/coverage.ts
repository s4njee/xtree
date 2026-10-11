// Line coverage of the library's own source from Chromium's V8 coverage of
// the fixture page (X18.1). Vite serves each source file transformed, with an
// inline source map; each V8 block count is mapped back to source lines.
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const coverageDir = fileURLToPath(
  new URL('../../../../.cache/xtree/coverage/', import.meta.url),
);

interface Range {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly count: number;
}
export interface ScriptCoverage {
  readonly url: string;
  readonly source?: string;
  readonly functions: readonly { readonly ranges: readonly Range[] }[];
}

/** Source file → line number (1-based) → 1 if it ran, 0 if not. */
export type LineCoverage = Record<string, Record<number, 0 | 1>>;

const alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const digits = new Map([...alphabet].map((c, i) => [c, i]));

/** Decodes source map mappings into [generated line, column, source line] triples. */
function decode(mappings: string): [number, number, number][] {
  const out: [number, number, number][] = [];
  let sourceLine = 0;
  let line = 0;
  for (const group of mappings.split(';')) {
    let column = 0;
    for (const segment of group.split(',')) {
      if (!segment) continue;
      const values: number[] = [];
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = digits.get(char)!;
        value += (digit & 31) << shift;
        if (digit & 32) shift += 5;
        else {
          values.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = 0;
          shift = 0;
        }
      }
      column += values[0]!;
      if (values.length >= 4) {
        sourceLine += values[2]!;
        out.push([line, column, sourceLine]);
      }
    }
    line++;
  }
  return out;
}

/** Lines of `packages/xtree/src` files that ran (or didn't) in these scripts. */
export function toLineCoverage(
  scripts: readonly ScriptCoverage[],
): LineCoverage {
  const result: LineCoverage = {};
  for (const script of scripts) {
    const path = decodeURIComponent(
      new URL(script.url).pathname.replace(/^\/@fs/, ''),
    );
    const marker = path.indexOf('/packages/xtree/src/');
    if (marker === -1 || !script.source || !/\.ts$/.test(path)) continue;
    const file = path.slice(marker + '/packages/xtree/'.length);
    const map =
      /\/\/# sourceMappingURL=data:application\/json;base64,(\S+)\s*$/.exec(
        script.source,
      );
    if (!map) continue;
    const { mappings } = JSON.parse(
      Buffer.from(map[1]!, 'base64').toString('utf8'),
    ) as { mappings: string };
    // Paint counts outer ranges first, so nested blocks overwrite them.
    const counts = new Int32Array(script.source.length);
    const ranges = script.functions
      .flatMap((fn) => fn.ranges)
      .sort(
        (a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset,
      );
    for (const range of ranges)
      counts.fill(range.count, range.startOffset, range.endOffset);
    const lineStarts = [0];
    for (let i = 0; i < script.source.length; i++)
      if (script.source.charCodeAt(i) === 10) lineStarts.push(i + 1);
    const lines = (result[file] ??= {});
    for (const [line, column, sourceLine] of decode(mappings)) {
      const offset = (lineStarts[line] ?? 0) + column;
      const ran = counts[offset]! > 0 ? 1 : 0;
      const key = sourceLine + 1;
      lines[key] = (lines[key] ?? 0) === 1 ? 1 : ran;
    }
  }
  return result;
}

/** Writes one page's coverage for the report script to merge. */
export function saveCoverage(scripts: readonly ScriptCoverage[]): void {
  mkdirSync(coverageDir, { recursive: true });
  writeFileSync(
    `${coverageDir}${randomUUID()}.json`,
    JSON.stringify(toLineCoverage(scripts)),
  );
}
