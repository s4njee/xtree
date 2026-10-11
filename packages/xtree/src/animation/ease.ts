/** An easing: progress 0–1 in, eased progress out. */
export type Ease = (progress: number) => number;

const keywords: Record<string, readonly [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

const identity: Ease = (t) => t;

/** CSS `cubic-bezier()`: x solved by Newton's method with a bisection fallback. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (target: number) => {
    let t = target;
    for (let i = 0; i < 8; i++) {
      const error = x(t) - target;
      if (Math.abs(error) < 1e-7) return t;
      const slope = dx(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = target;
    for (let i = 0; i < 40; i++) {
      const value = x(t);
      if (Math.abs(value - target) < 1e-7) break;
      if (value < target) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : y(solve(p)));
}

/** CSS `steps(n, position)`. */
function steps(count: number, position: string): Ease {
  const jump =
    position === 'jump-start' || position === 'start'
      ? 'start'
      : position === 'jump-none'
        ? 'none'
        : position === 'jump-both'
          ? 'both'
          : 'end';
  const intervals =
    jump === 'none' ? count - 1 : jump === 'both' ? count + 1 : count;
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let step = Math.floor(p * count);
    if (jump === 'start' || jump === 'both') step += 1;
    return Math.min(step, intervals) / intervals;
  };
}

/** CSS `linear()` stops: `output [input%] [input%]`, inputs filled in and made increasing. */
function linearStops(body: string): Ease {
  const points: { y: number; x?: number }[] = [];
  for (const part of body.split(',')) {
    const [value, ...inputs] = part.trim().split(/\s+/);
    const y = Number(value);
    if (!Number.isFinite(y)) return identity;
    if (inputs.length === 0) points.push({ y });
    for (const input of inputs) {
      const x = Number.parseFloat(input) / 100;
      if (!Number.isFinite(x)) return identity;
      points.push({ y, x });
    }
  }
  if (points.length < 2) return identity;
  if (points[0]!.x === undefined) points[0]!.x = 0;
  if (points.at(-1)!.x === undefined) points.at(-1)!.x = 1;
  // Inputs never decrease.
  let max = -Infinity;
  for (const point of points)
    if (point.x !== undefined) point.x = max = Math.max(max, point.x);
  // Missing inputs are spread evenly between their neighbors.
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.x !== undefined) continue;
    let j = i;
    while (points[j]!.x === undefined) j++;
    const from = points[i - 1]!.x!;
    const to = points[j]!.x!;
    for (let k = i; k < j; k++)
      points[k]!.x = from + ((to - from) * (k - i + 1)) / (j - i + 1);
  }
  return (p) => {
    if (p <= points[0]!.x!) return points[0]!.y;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      if (p <= b.x!)
        return b.x! === a.x!
          ? b.y
          : a.y + ((b.y - a.y) * (p - a.x!)) / (b.x! - a.x!);
    }
    return points.at(-1)!.y;
  };
}

/**
 * Parses a CSS easing: `linear`, `ease`, `ease-in`, `ease-out`,
 * `ease-in-out`, `step-start`, `step-end`, `cubic-bezier()`, `steps()` and
 * `linear()`, as in CSS Easing Functions Level 2. HoloCSS's `values()` reads
 * the same strings from its `--hcss-ease-*` tokens. Anything unrecognized
 * eases linearly.
 */
export function cssEase(value: string): Ease {
  const text = value.trim().toLowerCase();
  if (text in keywords) return cubicBezier(...keywords[text]!);
  if (text === 'step-start') return steps(1, 'start');
  if (text === 'step-end') return steps(1, 'end');
  const call = /^([a-z-]+)\((.*)\)$/.exec(text);
  if (!call) return identity;
  const [, name, body] = call as unknown as [string, string, string];
  if (name === 'cubic-bezier') {
    const n = body.split(',').map((s) => Number(s.trim()));
    if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return identity;
    if (n[0]! < 0 || n[0]! > 1 || n[2]! < 0 || n[2]! > 1) return identity;
    return cubicBezier(n[0]!, n[1]!, n[2]!, n[3]!);
  }
  if (name === 'steps') {
    const [count, position = 'end'] = body.split(',').map((s) => s.trim());
    const n = Number(count);
    const min = position === 'jump-none' ? 2 : 1;
    if (!Number.isInteger(n) || n < min) return identity;
    return steps(n, position);
  }
  if (name === 'linear') return linearStops(body);
  return identity;
}
