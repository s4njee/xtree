/** Where animations get time and frames from. Defaults to `performance.now()` and `requestAnimationFrame`. */
export interface Scheduler {
  /** Milliseconds. */
  now(): number;
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export const defaultScheduler: Scheduler = {
  now: () => globalThis.performance?.now() ?? Date.now(),
  request: (callback) =>
    globalThis.requestAnimationFrame
      ? globalThis.requestAnimationFrame(callback)
      : (globalThis.setTimeout(callback, 16) as unknown as number),
  cancel: (handle) =>
    globalThis.cancelAnimationFrame
      ? globalThis.cancelAnimationFrame(handle)
      : globalThis.clearTimeout(handle),
};
