import { defaultScheduler, type Scheduler } from './clock.js';
import {
  clampToParam,
  getParam,
  interpolate,
  paramOf,
  setParam,
  type Animatable,
} from './values.js';
import type { Timeline } from './timeline.js';

/** Maps a normalized input to a parameter value: `[0, 1]` across its declared range unless `map` is given. */
function mapper(
  target: Animatable,
  name: string,
  map?: (input: readonly number[]) => unknown,
): (input: readonly number[]) => unknown {
  const param = paramOf(target, name);
  if (map) return (input) => clampToParam(param, map(input));
  const range = param as { min?: number; max?: number };
  const lo = range.min ?? 0;
  const hi = range.max ?? 1;
  return (input) =>
    param.kind === 'vec2' || param.kind === 'vec3'
      ? input.map((v) => lo + (hi - lo) * v)
      : lo + (hi - lo) * input[0]!;
}

/**
 * Eases a parameter toward a moving goal every frame, framerate-independent:
 * `smoothing` is the time constant in seconds (0 jumps straight there).
 */
function follower(
  target: Animatable,
  name: string,
  smoothing: number,
  scheduler: Scheduler,
) {
  const param = paramOf(target, name);
  let goal = getParam(target, name);
  let handle = 0;
  let last = 0;
  const step = () => {
    handle = 0;
    const now = scheduler.now();
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    const current = getParam(target, name);
    const k = smoothing > 0 ? 1 - Math.exp(-dt / smoothing) : 1;
    const next = interpolate(param, current, goal, k);
    setParam(target, name, next);
    const settled = JSON.stringify(next) === JSON.stringify(goal);
    if (!settled) handle = scheduler.request(step);
    else setParam(target, name, goal);
  };
  return {
    set(value: unknown) {
      goal = value;
      if (!handle) {
        last = scheduler.now();
        handle = scheduler.request(step);
      }
    },
    stop() {
      if (handle) scheduler.cancel(handle);
      handle = 0;
    },
  };
}

/** Options for `followPointer`. */
export interface FollowPointerOptions {
  /** The element whose area maps to 0–1 (usually the canvas). */
  readonly element: Element;
  /** Seconds to settle; defaults to 0.12. */
  readonly smoothing?: number;
  /** Value at rest: when the pointer leaves, on touch and coarse pointers. Defaults to the value when bound. */
  readonly rest?: unknown;
  /** Custom mapping from the pointer's UV (origin bottom left) to the value. */
  readonly map?: (uv: readonly [number, number]) => unknown;
  readonly scheduler?: Scheduler;
}

/**
 * Makes a parameter follow the pointer over `element`, smoothed. Like
 * HoloCSS's `createTilt`, only fine hover-capable pointers drive it: touch
 * and coarse pointers leave it at rest, and leaving the element (or the
 * window losing focus) returns it to rest. A `vec2` parameter gets the
 * pointer's position across its range; a float gets its x.
 * Returns a function that stops following and restores the rest value.
 *
 * ```ts
 * const stop = followPointer(foil, 'tilt', { element: canvas });
 * ```
 */
export function followPointer(
  target: Animatable,
  name: string,
  options: FollowPointerOptions,
): () => void {
  const { element } = options;
  const view = element.ownerDocument.defaultView;
  if (!view) return () => {};
  const rest = options.rest ?? getParam(target, name);
  const map = mapper(
    target,
    name,
    options.map as ((input: readonly number[]) => unknown) | undefined,
  );
  const follow = follower(
    target,
    name,
    options.smoothing ?? 0.12,
    options.scheduler ?? defaultScheduler,
  );
  const fine = view.matchMedia('(hover: hover) and (pointer: fine)');
  const onMove = (event: PointerEvent) => {
    if (!fine.matches || event.pointerType === 'touch') return;
    const rect = element.getBoundingClientRect();
    const u = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const v = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
    follow.set(map([Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))]));
  };
  const toRest = () => follow.set(rest);
  element.addEventListener('pointermove', onMove as EventListener, {
    passive: true,
  });
  element.addEventListener('pointerleave', toRest);
  element.addEventListener('pointercancel', toRest);
  view.addEventListener('blur', toRest);
  fine.addEventListener('change', toRest);
  return () => {
    element.removeEventListener('pointermove', onMove as EventListener);
    element.removeEventListener('pointerleave', toRest);
    element.removeEventListener('pointercancel', toRest);
    view.removeEventListener('blur', toRest);
    fine.removeEventListener('change', toRest);
    follow.stop();
    setParam(target, name, rest);
  };
}

type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Asks for device-orientation access where the browser requires it (iOS
 * Safari). Call it from a user gesture such as a click. Resolves true when
 * orientation events can be used.
 */
export async function requestOrientationPermission(
  view: Window = globalThis as unknown as Window,
): Promise<boolean> {
  const Orientation = (
    view as unknown as { DeviceOrientationEvent?: OrientationConstructor }
  ).DeviceOrientationEvent;
  if (!Orientation) return false;
  if (typeof Orientation.requestPermission !== 'function') return true;
  try {
    return (await Orientation.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Options for `bindOrientation`. */
export interface BindOrientationOptions extends FollowPointerOptions {
  /** Degrees of tilt that reach the ends of the range. Defaults to 30. */
  readonly range?: number;
}

/**
 * Drives a parameter from how the device is tilted (`beta` front-to-back,
 * `gamma` left-to-right), for tilt-driven holographic effects on phones. It
 * falls back to the pointer (as `followPointer`) until orientation events
 * arrive, and the parameter rests when neither is available. On iOS, events
 * only arrive after `requestOrientationPermission()` from a user gesture.
 * Returns a function that stops and restores the rest value.
 */
export function bindOrientation(
  target: Animatable,
  name: string,
  options: BindOrientationOptions,
): () => void {
  const view = options.element.ownerDocument.defaultView;
  if (!view) return () => {};
  const rest = options.rest ?? getParam(target, name);
  const range = options.range ?? 30;
  const map = mapper(
    target,
    name,
    options.map as ((input: readonly number[]) => unknown) | undefined,
  );
  const follow = follower(
    target,
    name,
    options.smoothing ?? 0.12,
    options.scheduler ?? defaultScheduler,
  );
  let stopPointer: (() => void) | null = followPointer(target, name, options);
  let reference: [number, number] | null = null;
  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;
    // The first reading is the neutral pose, so it works however the phone is held.
    reference ??= [event.beta, event.gamma];
    if (stopPointer) {
      stopPointer();
      stopPointer = null;
    }
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const x = clamp(0.5 + (event.gamma - reference[1]) / (2 * range));
    const y = clamp(0.5 - (event.beta - reference[0]) / (2 * range));
    follow.set(map([x, y]));
  };
  view.addEventListener('deviceorientation', onOrientation);
  return () => {
    view.removeEventListener('deviceorientation', onOrientation);
    stopPointer?.();
    follow.stop();
    setParam(target, name, rest);
  };
}

/** Options for `bindAudio`. */
export interface BindAudioOptions {
  /** The parameter to drive. */
  readonly param: string;
  /** The frequency band: bass (20–250 Hz), mid (250 Hz–4 kHz), treble (4–16 kHz) or level. */
  readonly band?: 'bass' | 'mid' | 'treble' | 'level';
  /** How much a full-scale band adds to the parameter's value when bound. Defaults to its range. */
  readonly gain?: number;
  /** Seconds to settle; defaults to 0.08. */
  readonly smoothing?: number;
  readonly scheduler?: Scheduler;
}

/**
 * Makes a numeric parameter react to audio from an `AnalyserNode` you
 * create (nothing is captured or played here). It is decorative: never put
 * meaning only in audio-reactive motion. A suspended `AudioContext` resumes
 * on the next user gesture, as browsers require. Returns a function that
 * stops and restores the value.
 */
export function bindAudio(
  target: Animatable,
  analyser: AnalyserNode,
  options: BindAudioOptions,
): () => void {
  const { param: name } = options;
  const param = paramOf(target, name);
  const base = getParam(target, name) as number;
  const range = param as { min?: number; max?: number };
  const gain = options.gain ?? (range.max ?? 1) - (range.min ?? 0);
  const scheduler = options.scheduler ?? defaultScheduler;
  const follow = follower(target, name, options.smoothing ?? 0.08, scheduler);
  const context = analyser.context as AudioContext;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const binHz = context.sampleRate / analyser.fftSize;
  const bands = {
    bass: [20, 250],
    mid: [250, 4000],
    treble: [4000, 16000],
    level: [0, context.sampleRate / 2],
  } as const;
  const [low, high] = bands[options.band ?? 'level'];
  const from = Math.max(0, Math.floor(low / binHz));
  const to = Math.min(data.length, Math.ceil(high / binHz));
  const view = globalThis as unknown as Window;
  const resume = () => void context.resume?.();
  const gestures = ['pointerdown', 'keydown'] as const;
  if (context.state === 'suspended')
    for (const type of gestures)
      view.addEventListener?.(type, resume, { once: true });
  let handle = 0;
  const tick = () => {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = from; i < to; i++) sum += data[i]!;
    const level = to > from ? sum / (to - from) / 255 : 0;
    follow.set(clampToParam(param, base + level * gain));
    handle = scheduler.request(tick);
  };
  handle = scheduler.request(tick);
  return () => {
    scheduler.cancel(handle);
    follow.stop();
    for (const type of gestures) view.removeEventListener?.(type, resume);
    setParam(target, name, base);
  };
}

/** Options for `bindScroll`. */
export interface BindScrollOptions {
  /** The scrolling element. Defaults to the document's. */
  readonly scroller?: Element;
  /** Defaults to `block` (vertical in horizontal writing). */
  readonly axis?: 'block' | 'inline' | 'x' | 'y';
  /** Maps scroll progress to the value; defaults to across the parameter's range. */
  readonly map?: (progress: number) => unknown;
  readonly scheduler?: Scheduler;
}

/**
 * Drives a parameter, or a `timeline`, from scroll progress with HoloCSS's
 * `scrollProgress` semantics: 0 at the scroller's start and 1 at the end of
 * its scroll range. It reads a native `ScrollTimeline` where the browser has
 * one and measures the scroll position otherwise, sampled once per frame
 * after scrolling or resizing. Returns a function that stops it.
 *
 * ```ts
 * bindScroll(story); // a timeline
 * bindScroll(vignette, 'darkness');
 * ```
 */
export function bindScroll(
  target: Animatable | Timeline,
  name?: string | BindScrollOptions,
  options: BindScrollOptions = {},
): () => void {
  if (typeof name === 'object') {
    options = name;
    name = undefined;
  }
  const scheduler = options.scheduler ?? defaultScheduler;
  const doc = options.scroller?.ownerDocument ?? globalThis.document;
  const view = doc?.defaultView;
  const scroller = options.scroller ?? doc?.scrollingElement;
  if (!view || !scroller) return () => {};
  const axis = options.axis ?? 'block';
  const horizontal = axis === 'x' || axis === 'inline';
  let write: (progress: number) => void;
  if (typeof name === 'string') {
    const animatable = target as Animatable;
    const key = name;
    const param = paramOf(animatable, key);
    const across = mapper(animatable, key);
    const map = options.map;
    const toValue = map
      ? (p: number) => clampToParam(param, map(p))
      : (p: number) => across([p]);
    write = (p) => setParam(animatable, key, toValue(p));
  } else {
    write = (p) => {
      (target as Timeline).progress = p;
    };
  }
  // A native ScrollTimeline driving a detached animation, read once per frame.
  const Native = (
    view as unknown as {
      ScrollTimeline?: new (options: {
        source: Element;
        axis: string;
      }) => AnimationTimeline;
    }
  ).ScrollTimeline;
  let animation: Animation | null = null;
  if (Native) {
    const probe = doc.createElement('span');
    animation = new view.Animation(
      new view.KeyframeEffect(probe, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 'auto' as never,
        fill: 'both',
      }),
      new Native({ source: scroller, axis }),
    );
    animation.play();
  }
  const measure = () => {
    if (animation) {
      const p = animation.effect?.getComputedTiming().progress;
      return typeof p === 'number' ? p : 0;
    }
    const range = horizontal
      ? scroller.scrollWidth - scroller.clientWidth
      : scroller.scrollHeight - scroller.clientHeight;
    const position = horizontal ? scroller.scrollLeft : scroller.scrollTop;
    return range > 0 ? Math.min(1, Math.max(0, position / range)) : 0;
  };
  let handle = 0;
  let last = Number.NaN;
  const sample = () => {
    handle = 0;
    const p = measure();
    if (p !== last) write((last = p));
  };
  const schedule = () => {
    if (!handle) handle = scheduler.request(sample);
  };
  const source: EventTarget =
    scroller === doc.scrollingElement ? view : scroller;
  source.addEventListener('scroll', schedule, { passive: true });
  view.addEventListener('resize', schedule, { passive: true });
  sample();
  return () => {
    source.removeEventListener('scroll', schedule);
    view.removeEventListener('resize', schedule);
    if (handle) scheduler.cancel(handle);
    animation?.cancel();
  };
}
