import type { EffectComposer } from './composer.js';

/** The overlay `createDebugOverlay` returns. */
export interface DebugOverlay {
  readonly element: HTMLElement;
  /** Copies a pass's fragment shader to the clipboard (or returns it). */
  shaderSource(passIndex: number): string;
  /** Removes the overlay and restores the composer's timing setting. */
  dispose(): void;
}

/**
 * A small text overlay listing the composer's passes with their effects,
 * compiles, buffers and GPU time, plus frame rate, draw calls and programs.
 * Turns on `composer.timing`. Updates about four times a second.
 *
 * ```ts
 * const overlay = createDebugOverlay(composer, document.body);
 * ```
 */
export function createDebugOverlay(
  composer: EffectComposer,
  parent: HTMLElement,
): DebugOverlay {
  const doc = parent.ownerDocument;
  const view = doc.defaultView!;
  const element = doc.createElement('pre');
  element.className = 'xt-debug';
  element.setAttribute('aria-live', 'off');
  element.style.cssText =
    'position:absolute;top:8px;left:8px;margin:0;padding:6px 8px;font:11px/1.4 ui-monospace,monospace;color:#e8f0ff;background:rgb(0 0 0 / 0.7);border-radius:4px;pointer-events:none;z-index:10;white-space:pre;';
  parent.append(element);
  const wasTiming = composer.timing;
  composer.timing = true;
  let frames = 0;
  let last = view.performance.now();
  let raf = 0;
  const update = () => {
    frames++;
    const now = view.performance.now();
    if (now - last >= 250) {
      const fps = (frames * 1000) / (now - last);
      frames = 0;
      last = now;
      const info = composer.renderer.info;
      const timings = composer.timings;
      const lines = [
        `${fps.toFixed(0)} fps · ${info.render.calls} draws · ${info.programs?.length ?? 0} programs`,
        timings
          ? `scene ${(timings.scene ?? 0).toFixed(2)} ms · prepasses ${(timings.prepasses ?? 0).toFixed(2)} ms`
          : 'GPU timing unavailable',
        ...composer
          .describe()
          .map(
            (p) =>
              `${p.label}: ${p.effects.join(' + ') || 'output'}${p.buffers.length ? ` [${p.buffers.join(', ')}]` : ''} · ${p.compiles} compile${p.compiles === 1 ? '' : 's'}${p.gpuMs === null ? '' : ` · ${p.gpuMs.toFixed(2)} ms`}`,
          ),
      ];
      element.textContent = lines.join('\n');
    }
    raf = view.requestAnimationFrame(update);
  };
  raf = view.requestAnimationFrame(update);
  return {
    element,
    shaderSource(index) {
      const source = composer.describe()[index]?.source ?? '';
      void view.navigator.clipboard?.writeText(source).catch(() => {});
      return source;
    },
    dispose() {
      view.cancelAnimationFrame(raf);
      element.remove();
      composer.timing = wasTiming;
    },
  };
}
