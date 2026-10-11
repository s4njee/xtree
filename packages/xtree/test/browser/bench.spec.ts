import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from './test.js';
import { openFixture } from './fixture.js';

// The benchmark harness (X17.2), run by `pnpm bench`; skipped otherwise.
const options = process.env.XT_BENCH
  ? (JSON.parse(process.env.XT_BENCH) as {
      effects: string[];
      frames: number;
      width: number;
      height: number;
      out: string | null;
      label: string | null;
    })
  : null;

test.skip(!options, 'run with pnpm bench');

test('benchmark', async ({ page }) => {
  test.setTimeout(0);
  await openFixture(page);
  const { effects, frames, width, height } = options!;
  const ids =
    effects.length > 0
      ? effects
      : await page.evaluate(() =>
          window.xt.factories.filter((id) => window.xt.kind(id) === 'post'),
        );
  const run = (list: string[]) =>
    page.evaluate((s) => window.xt.bench(s), {
      effects: list.map((id) => ({ id })),
      frames,
      width,
      height,
    });
  const baseline = await run([]);
  const results: Record<
    string,
    { costMs: number; medianMs: number; p95Ms: number; gpuMs: number | null }
  > = {};
  const rows: string[] = [];
  for (const id of ids) {
    const r = await run([id]);
    const costMs = Math.max(0, r.medianMs - baseline.medianMs);
    results[id] = {
      costMs: Number(costMs.toFixed(3)),
      medianMs: Number(r.medianMs.toFixed(3)),
      p95Ms: Number(r.p95Ms.toFixed(3)),
      gpuMs: r.gpuMedianMs === null ? null : Number(r.gpuMedianMs.toFixed(3)),
    };
    rows.push(
      `${id.padEnd(24)} ${costMs.toFixed(2).padStart(8)} ms  (frame ${r.medianMs.toFixed(2)}, p95 ${r.p95Ms.toFixed(2)}${r.gpuMedianMs === null ? '' : `, GPU ${r.gpuMedianMs.toFixed(2)}`})`,
    );
  }
  process.stdout.write(
    `\n${baseline.gpu} at ${width}×${height}, ${frames} frames per effect\n` +
      `baseline frame ${baseline.medianMs.toFixed(2)} ms\n` +
      `${'effect'.padEnd(24)} ${'cost'.padStart(8)}\n${rows.join('\n')}\n`,
  );
  if (options!.out) {
    const label = options!.label ?? baseline.gpu;
    const file = options!.out;
    mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
    // Merge into an existing file for the same machine, so single-effect runs update it.
    let previous: { results?: typeof results } = {};
    try {
      previous = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      /* new file */
    }
    writeFileSync(
      file,
      `${JSON.stringify(
        {
          label,
          gpu: baseline.gpu,
          width,
          height,
          frames,
          baselineMs: Number(baseline.medianMs.toFixed(3)),
          date: new Date().toISOString().slice(0, 10),
          results: { ...previous.results, ...results },
        },
        null,
        2,
      )}\n`,
    );
  }
  expect(Object.keys(results).length).toBe(ids.length);
});
