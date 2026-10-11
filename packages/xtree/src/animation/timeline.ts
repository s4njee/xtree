import { cssEase, type Ease } from './ease.js';
import { interpolate, paramOf, setParam, type Animatable } from './values.js';

/** One keyframe: where it sits (0–1), the values there, and the easing toward the next keyframe. */
export interface Keyframe {
  readonly at: number;
  readonly values: Readonly<Record<string, unknown>>;
  /** Easing from this keyframe to the next. Defaults to `linear`. */
  readonly easing?: string | Ease;
}

/** The keyframes of one effect. */
export interface Track {
  readonly target: Animatable;
  readonly keyframes: readonly Keyframe[];
}

/** A scrubbable timeline across several effects. */
export interface Timeline {
  /** Where the timeline is, 0–1. Setting it applies the values there. */
  progress: number;
}

/**
 * A timeline of parameter changes across several effects, scrubbable by
 * progress, for example from `bindScroll`. Between keyframes each parameter
 * interpolates (with the earlier keyframe's easing); before the first and
 * after the last keyframe that sets it, it holds.
 *
 * ```ts
 * const story = timeline([
 *   { target: bloom, keyframes: [{ at: 0, values: { intensity: 0 } }, { at: 0.5, values: { intensity: 2 }, easing: 'ease-in' }] },
 *   { target: grain, keyframes: [{ at: 0.4, values: { amount: 0 } }, { at: 1, values: { amount: 0.3 } }] },
 * ]);
 * story.progress = 0.25;
 * ```
 */
export function timeline(tracks: readonly Track[]): Timeline {
  // Per effect and parameter: the keyframes that set it, in order.
  const lanes = tracks.flatMap(({ target, keyframes }) => {
    const sorted = [...keyframes].sort((a, b) => a.at - b.at);
    const names = new Set(sorted.flatMap((k) => Object.keys(k.values)));
    return [...names].map((name) => ({
      target,
      name,
      param: paramOf(target, name),
      stops: sorted
        .filter((k) => name in k.values)
        .map((k) => ({
          at: k.at,
          value: k.values[name],
          ease:
            typeof k.easing === 'function'
              ? k.easing
              : cssEase(k.easing ?? 'linear'),
        })),
    }));
  });
  let progress = 0;
  const apply = () => {
    for (const lane of lanes) {
      const { stops } = lane;
      let value = stops[0]!.value;
      if (progress >= stops.at(-1)!.at) value = stops.at(-1)!.value;
      else
        for (let i = 1; i < stops.length; i++) {
          const a = stops[i - 1]!;
          const b = stops[i]!;
          if (progress < b.at) {
            if (progress > a.at) {
              const t = (progress - a.at) / Math.max(b.at - a.at, 1e-9);
              value = interpolate(lane.param, a.value, b.value, a.ease(t));
            } else value = a.value;
            break;
          }
        }
      setParam(lane.target, lane.name, value);
    }
  };
  apply();
  return {
    get progress() {
      return progress;
    },
    set progress(value: number) {
      progress = Math.min(1, Math.max(0, value));
      apply();
    },
  };
}
