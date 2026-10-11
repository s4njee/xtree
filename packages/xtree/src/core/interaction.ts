/**
 * Interaction inputs for `EffectComposer.inputs`: pointer, scroll and audio.
 * Each helper returns a function that stops it.
 */

/** Anything with composer-style `inputs`, such as an `EffectComposer`. */
export interface InputTarget {
  readonly inputs: {
    pointer: [number, number];
    pointerVelocity: [number, number];
    scroll: number;
    audio: [number, number, number, number];
  };
}

/**
 * Tracks the pointer over `element` (usually the canvas) in UV coordinates,
 * origin bottom left, so effects see where it is relative to the image even
 * when the canvas is offset, scaled or scrolled.
 */
export function trackPointer(
  target: InputTarget,
  element: Element,
): () => void {
  const view = element.ownerDocument.defaultView;
  if (!view) return () => {};
  let last: { x: number; y: number; t: number } | null = null;
  let still = 0;
  const onMove = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
    const t = event.timeStamp / 1000;
    if (last && t > last.t) {
      // Smoothed so single jumpy events don't spike the velocity.
      const [vx, vy] = target.inputs.pointerVelocity;
      const k = 0.5;
      target.inputs.pointerVelocity = [
        vx + ((x - last.x) / (t - last.t) - vx) * k,
        vy + ((y - last.y) / (t - last.t) - vy) * k,
      ];
    }
    last = { x, y, t };
    target.inputs.pointer = [x, y];
    view.clearTimeout(still);
    still = view.setTimeout(() => {
      target.inputs.pointerVelocity = [0, 0];
    }, 100);
  };
  view.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    view.removeEventListener('pointermove', onMove);
    view.clearTimeout(still);
  };
}

/**
 * Tracks scroll progress, 0–1: of the whole page, or of `element` passing
 * through the viewport (0 as its top enters at the bottom, 1 as its bottom
 * leaves at the top).
 */
export function trackScroll(
  target: InputTarget,
  element?: Element,
  view: Window = element?.ownerDocument.defaultView ?? window,
): () => void {
  const update = () => {
    let value: number;
    if (element) {
      const rect = element.getBoundingClientRect();
      value = (view.innerHeight - rect.top) / (view.innerHeight + rect.height);
    } else {
      const doc = view.document.documentElement;
      const range = doc.scrollHeight - view.innerHeight;
      value = range > 0 ? view.scrollY / range : 0;
    }
    target.inputs.scroll = Math.min(1, Math.max(0, value));
  };
  update();
  view.addEventListener('scroll', update, { passive: true });
  view.addEventListener('resize', update, { passive: true });
  return () => {
    view.removeEventListener('scroll', update);
    view.removeEventListener('resize', update);
  };
}

/**
 * Feeds an `AnalyserNode` into `xt_audio`: bass (20–250 Hz), mid
 * (250 Hz–4 kHz), treble (4–16 kHz) and overall level, each 0–1. Audio is
 * opt-in: nothing is created here, and a suspended `AudioContext` is resumed
 * only on the next user gesture, as browsers require.
 */
export function trackAudio(
  target: InputTarget,
  analyser: AnalyserNode,
): () => void {
  const context = analyser.context as AudioContext;
  const view = globalThis as unknown as Window;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const binHz = context.sampleRate / analyser.fftSize;
  const band = (low: number, high: number) => {
    const from = Math.max(0, Math.floor(low / binHz));
    const to = Math.min(data.length, Math.ceil(high / binHz));
    let sum = 0;
    for (let i = from; i < to; i++) sum += data[i]!;
    return to > from ? sum / (to - from) / 255 : 0;
  };
  let frame = 0;
  const tick = () => {
    analyser.getByteFrequencyData(data);
    let total = 0;
    for (const v of data) total += v;
    target.inputs.audio = [
      band(20, 250),
      band(250, 4000),
      band(4000, 16000),
      data.length ? total / data.length / 255 : 0,
    ];
    frame = view.requestAnimationFrame(tick);
  };
  const resume = () => {
    void context.resume?.();
  };
  const gestures = ['pointerdown', 'keydown'] as const;
  if (context.state === 'suspended')
    for (const type of gestures)
      view.addEventListener(type, resume, { once: true });
  frame = view.requestAnimationFrame(tick);
  return () => {
    view.cancelAnimationFrame(frame);
    for (const type of gestures) view.removeEventListener(type, resume);
    target.inputs.audio = [0, 0, 0, 0];
  };
}
