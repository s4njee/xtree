import type { ThemeRole } from '../effect/params.js';

/** Every role `resolveTheme` reads, as `--hcss-<role>`. */
export const themeRoles: readonly ThemeRole[] = [
  'accent',
  'background',
  'surface',
  'elevated-surface',
  'text',
  'text-muted',
  'success',
  'warning',
  'danger',
  'info',
];

/** Resolved theme colors as `#rrggbb` (sRGB). Roles the page doesn't define are left out. */
export type ThemeColors = Partial<Record<ThemeRole, string>>;

/**
 * Reads the HoloCSS color roles (`--hcss-accent`, `--hcss-surface` and the
 * rest) that apply to `element` and resolves each to `#rrggbb`. Any CSS
 * color the browser understands works, including `oklch()` and
 * `color-mix()`: each is painted into a 1×1 canvas and read back.
 */
export function resolveTheme(element: Element): ThemeColors {
  const doc = element.ownerDocument;
  const view = doc.defaultView!;
  const style = view.getComputedStyle(element);
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const colors: ThemeColors = {};
  if (!context) return colors;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  for (const role of themeRoles) {
    const value = style.getPropertyValue(`--hcss-${role}`).trim();
    if (!value) continue;
    if (view.CSS && !view.CSS.supports('color', value)) continue;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    // getImageData is unpremultiplied, so a translucent role keeps its hue.
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    colors[role] = `#${hex(r!)}${hex(g!)}${hex(b!)}`;
  }
  return colors;
}

interface ThemedParam {
  readonly kind: string;
  readonly theme?: ThemeRole;
}

/** An effect (or material effect) whose color parameters can follow the theme. */
export interface ThemedEffect {
  readonly definition: { readonly params: object };
  set(values: Record<string, unknown>): unknown;
}

/** A transition player, which takes the accent. */
export interface ThemedAccent {
  setAccent(hex: string): void;
}

export type ThemeTarget = ThemedEffect | ThemedAccent;

export interface BindThemeOptions {
  /**
   * Per-parameter roles that replace the ones effects declare, by parameter
   * name: a role to follow, or `null` to leave that parameter alone.
   */
  readonly roles?: Readonly<Record<string, ThemeRole | null>>;
  /** Called after each change is applied, with the resolved colors. */
  readonly onChange?: (colors: ThemeColors) => void;
}

/** Sets each target's theme-aware colors from `colors`. */
export function applyTheme(
  targets: ThemeTarget | readonly ThemeTarget[],
  colors: ThemeColors,
  options: Pick<BindThemeOptions, 'roles'> = {},
): void {
  const list = Array.isArray(targets) ? targets : [targets as ThemeTarget];
  for (const target of list) {
    if ('setAccent' in target) {
      if (colors.accent) target.setAccent(colors.accent);
      continue;
    }
    const values: Record<string, string> = {};
    for (const [name, param] of Object.entries(target.definition.params) as [
      string,
      ThemedParam,
    ][]) {
      if (param.kind !== 'color') continue;
      const role =
        options.roles && name in options.roles
          ? options.roles[name]
          : param.theme;
      const color = role ? colors[role] : undefined;
      if (color) values[name] = color;
    }
    if (Object.keys(values).length) target.set(values);
  }
}

/**
 * Keeps targets' theme-aware colors in step with the HoloCSS theme that
 * applies to `element`: sets them now, and again whenever the theme changes
 * (a `data-hcss-theme`, `class` or `style` change on the element or an
 * ancestor, or a color-scheme or contrast preference change). Colors you set
 * on those parameters yourself are replaced on the next change. Returns a
 * function that stops following the theme.
 *
 * ```ts
 * const unbind = bindTheme([outline, fog, transitionPlayer], canvas);
 * ```
 */
export function bindTheme(
  targets: ThemeTarget | readonly ThemeTarget[],
  element: Element,
  options: BindThemeOptions = {},
): () => void {
  const view = element.ownerDocument.defaultView;
  let key = '';
  const update = () => {
    const colors = resolveTheme(element);
    const next = JSON.stringify(colors);
    if (next === key) return;
    key = next;
    applyTheme(targets, colors, options);
    options.onChange?.(colors);
  };
  update();
  if (!view) return () => {};
  const observer = new view.MutationObserver((records) => {
    if (records.some((record) => record.target.contains(element))) update();
  });
  observer.observe(element.getRootNode(), {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-hcss-theme', 'class', 'style'],
  });
  const queries = [
    view.matchMedia('(prefers-color-scheme: dark)'),
    view.matchMedia('(prefers-contrast: more)'),
  ];
  for (const query of queries) query.addEventListener('change', update);
  // Stylesheets that load later can define the roles.
  view.addEventListener('load', update);
  return () => {
    observer.disconnect();
    for (const query of queries) query.removeEventListener('change', update);
    view.removeEventListener('load', update);
  };
}
