import { defaultScheduler, type Scheduler } from './clock.js';
import { cssEase, type Ease } from './ease.js';
import {
  getParam,
  interpolate,
  paramOf,
  setParam,
  type Animatable,
} from './values.js';

/** Options for `animate`. */
export interface AnimateOptions {
  /** Milliseconds. Defaults to 300. */
  readonly duration?: number;
  /** Milliseconds before it starts. Defaults to 0. */
  readonly delay?: number;
  /** A CSS easing string, or a function. Defaults to `ease`. */
  readonly easing?: string | Ease;
  /** Aborting cancels the animation where it is. */
  readonly signal?: AbortSignal;
  /**
   * When false (for example `motionAllowed(element)` under reduced motion),
   * the values are set at once and the animation finishes immediately.
   */
  readonly motion?: boolean;
  /** Time and frames, for tests or a custom loop. */
  readonly scheduler?: Scheduler;
}

/** A running parameter animation. */
export interface ParamAnimation {
  /** Resolves when it ends: `finished`, or `canceled` (by `cancel`, the signal or a newer animation of the same parameter). */
  readonly finished: Promise<'finished' | 'canceled'>;
  /** Stops where it is. */
  cancel(): void;
}

// The animation driving each parameter, so a newer one takes over.
const running = new WeakMap<object, Map<string, () => void>>();

/**
 * Animates parameters of an effect (or material effect, or transition) to
 * new values, like CSS transitions: `effect.animate`-style tweening with CSS
 * easing strings, including `cubic-bezier()`, `steps()` and `linear()`.
 * Numbers and vectors interpolate, ints round, colors blend in linear RGB,
 * and other values switch at the end. Starting an animation of a parameter
 * cancels the one already running on it.
 *
 * ```ts
 * await animate(bloom, { intensity: 2 }, { duration: 600, easing: 'ease-out' }).finished;
 * ```
 */
export function animate(
  target: Animatable,
  values: Readonly<Record<string, unknown>>,
  options: AnimateOptions = {},
): ParamAnimation {
  const scheduler = options.scheduler ?? defaultScheduler;
  const ease =
    typeof options.easing === 'function'
      ? options.easing
      : cssEase(options.easing ?? 'ease');
  const duration = Math.max(0, options.duration ?? 300);
  const delay = Math.max(0, options.delay ?? 0);
  const tracks = Object.entries(values).map(([name, to]) => ({
    name,
    param: paramOf(target, name),
    from: getParam(target, name),
    to,
  }));
  let resolve!: (state: 'finished' | 'canceled') => void;
  const finished = new Promise<'finished' | 'canceled'>((r) => (resolve = r));
  let handle = 0;
  let done = false;
  const owned = running.get(target) ?? new Map<string, () => void>();
  running.set(target, owned);
  const end = (state: 'finished' | 'canceled') => {
    if (done) return;
    done = true;
    scheduler.cancel(handle);
    for (const { name } of tracks)
      if (owned.get(name) === cancel) owned.delete(name);
    options.signal?.removeEventListener('abort', cancel);
    resolve(state);
  };
  const cancel = () => end('canceled');
  for (const { name } of tracks) {
    owned.get(name)?.();
    owned.set(name, cancel);
  }
  const apply = (t: number) => {
    for (const track of tracks)
      setParam(
        target,
        track.name,
        interpolate(track.param, track.from, track.to, t),
      );
  };
  if (options.signal?.aborted) {
    cancel();
    return { finished, cancel };
  }
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.motion === false || duration === 0) {
    apply(1);
    end('finished');
    return { finished, cancel };
  }
  const start = scheduler.now() + delay;
  const frame = () => {
    if (done) return;
    const elapsed = scheduler.now() - start;
    if (elapsed >= duration) {
      apply(1);
      end('finished');
      return;
    }
    if (elapsed >= 0) apply(ease(elapsed / duration));
    handle = scheduler.request(frame);
  };
  handle = scheduler.request(frame);
  return { finished, cancel };
}
