/**
 * Blue-noise threshold maps by the void-and-cluster method (Ulichney,
 * "The void-and-cluster method for dither array generation", SPIE 1993).
 * Deterministic for a given size and seed.
 */

function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns ranks 0..size²−1 for a size × size toroidal blue-noise pattern. */
export function voidAndCluster(size = 64, sigma = 1.5, seed = 1): Uint32Array {
  const n = size * size;
  // Toroidal Gaussian kernel by offset.
  const kernel = new Float64Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - x);
      const dy = Math.min(y, size - y);
      kernel[y * size + x] = Math.exp(
        -(dx * dx + dy * dy) / (2 * sigma * sigma),
      );
    }
  }
  const pattern = new Uint8Array(n);
  const energy = new Float64Array(n);
  const toggle = (index: number, on: boolean) => {
    pattern[index] = on ? 1 : 0;
    const ix = index % size;
    const iy = (index / size) | 0;
    const sign = on ? 1 : -1;
    for (let y = 0; y < size; y++) {
      const row = ((y - iy + size) % size) * size;
      for (let x = 0; x < size; x++)
        energy[y * size + x]! += sign * kernel[row + ((x - ix + size) % size)]!;
    }
  };
  const extreme = (value: 0 | 1, max: boolean) => {
    let best = -1;
    let bestEnergy = max ? -Infinity : Infinity;
    for (let i = 0; i < n; i++) {
      if (pattern[i] !== value) continue;
      const e = energy[i]!;
      if (max ? e > bestEnergy : e < bestEnergy) {
        bestEnergy = e;
        best = i;
      }
    }
    return best;
  };

  // Initial pattern: about 10% of pixels, then relaxed until stable.
  const next = random(seed);
  const initial = Math.max(1, Math.round(n * 0.1));
  for (let placed = 0; placed < initial;) {
    const i = Math.floor(next() * n);
    if (!pattern[i]) {
      toggle(i, true);
      placed++;
    }
  }
  for (let guard = 0; guard < n; guard++) {
    const cluster = extreme(1, true);
    toggle(cluster, false);
    const gap = extreme(0, false);
    toggle(gap, true);
    if (gap === cluster) break;
  }
  const start = pattern.slice();
  const startEnergy = energy.slice();
  const rank = new Uint32Array(n);
  // Phase 1: remove the tightest clusters, ranking downward.
  for (let r = initial - 1; r >= 0; r--) {
    const cluster = extreme(1, true);
    toggle(cluster, false);
    rank[cluster] = r;
  }
  // Phases 2 and 3: fill the largest voids, ranking upward.
  pattern.set(start);
  energy.set(startEnergy);
  for (let r = initial; r < n; r++) {
    const gap = extreme(0, false);
    toggle(gap, true);
    rank[gap] = r;
  }
  return rank;
}

let cached: Uint8Array | null = null;

/** A 64×64 blue-noise threshold texture as RGBA bytes (computed once per page). */
export function blueNoiseTexels(): Uint8Array {
  if (!cached) {
    const size = 64;
    const rank = voidAndCluster(size);
    cached = new Uint8Array(size * size * 4);
    for (let i = 0; i < rank.length; i++) {
      const v = Math.floor((rank[i]! / rank.length) * 256);
      cached.set([v, v, v, 255], i * 4);
    }
  }
  return cached;
}
