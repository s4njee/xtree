/**
 * The motion policy, without HoloCSS: the same rule HoloCSS's runtime applies
 * (`motionAllowed`/`watchMotion`), so xtree pages behave the same with or
 * without it. Motion is off under OS reduced motion, inside
 * `[data-hcss-motion="none"]` or the `high-contrast` theme, and under
 * `prefers-contrast: more` while the theme is `auto`.
 */

const off = '[data-hcss-motion="none"], [data-hcss-theme="high-contrast"]';

/** Whether `element` may animate. */
export function motionAllowed(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  return !(
    (view && view.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    element.closest(off) ||
    (view?.matchMedia('(prefers-contrast: more)').matches &&
      element.closest('[data-hcss-theme="auto"]'))
  );
}

/** Calls back when the answer for `element` changes. Returns a function that stops watching. */
export function watchMotion(
  element: Element,
  callback: (allowed: boolean) => void,
): () => void {
  const view = element.ownerDocument.defaultView;
  if (!view) return () => {};
  const media = view.matchMedia('(prefers-reduced-motion: reduce)');
  const contrast = view.matchMedia('(prefers-contrast: more)');
  let allowed = motionAllowed(element);
  const check = () => {
    if (allowed !== (allowed = motionAllowed(element))) callback(allowed);
  };
  const observer = new view.MutationObserver(check);
  observer.observe(element.getRootNode(), {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-hcss-motion', 'data-hcss-theme'],
  });
  media.addEventListener('change', check);
  contrast.addEventListener('change', check);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', check);
    contrast.removeEventListener('change', check);
  };
}

/** Anything that follows the motion policy: a composer (`motion`) or an effect (`setMotion`). */
export type MotionTarget =
  { motion: boolean } | { setMotion(allowed: boolean): void };

/** A motion policy implementation, such as HoloCSS's runtime. */
export interface MotionPolicy {
  motionAllowed(element: Element): boolean;
  watchMotion(
    element: Element,
    callback: (allowed: boolean) => void,
  ): () => void;
}

const builtIn: MotionPolicy = { motionAllowed, watchMotion };

/**
 * Keeps targets in step with the motion policy for `element`: applies it now
 * and on every change. Returns a function that stops following it.
 *
 * ```ts
 * const unbind = bindMotion([composer, hologramEffect], canvas);
 * ```
 */
export function bindMotion(
  targets: MotionTarget | readonly MotionTarget[],
  element: Element,
  policy: MotionPolicy = builtIn,
): () => void {
  const list = Array.isArray(targets) ? targets : [targets as MotionTarget];
  const apply = (allowed: boolean) => {
    for (const target of list) {
      if ('setMotion' in target) target.setMotion(allowed);
      else target.motion = allowed;
    }
  };
  apply(policy.motionAllowed(element));
  return policy.watchMotion(element, apply);
}
