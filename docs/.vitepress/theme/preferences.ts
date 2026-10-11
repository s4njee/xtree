import { shallowRef } from 'vue';

/**
 * The site's HoloCSS theme and motion preferences, shared by the header
 * controls and the demos. Both persist under HoloCSS's own storage keys
 * (`hcss-theme`, `hcss-motion`), so a choice carries across mk7s sites; the
 * blocking script in config.ts restores them before first paint.
 */
export interface Preferences {
  theme: string;
  themes: readonly { id: string; label: string }[];
  setTheme(theme: string): void;
  motion: 'auto' | 'none';
  /** Whether motion is allowed after the OS setting and the theme. */
  motionAllowed: boolean;
  setMotion(preference: 'auto' | 'none'): void;
}

export const preferences = shallowRef<Preferences | null>(null);

const builtInLabels: Record<string, string> = {
  auto: 'Auto (system)',
  'shadcn-dark': 'shadcn Dark',
  'shadcn-light': 'shadcn Light',
  dark: 'Dark',
  light: 'Light',
  'high-contrast': 'High contrast',
  ceres: 'Ceres',
  glass: 'Glass',
};

let started = false;

/** Creates the controllers once, in the browser. */
export async function startPreferences(): Promise<void> {
  if (started || typeof document === 'undefined') return;
  started = true;
  const [{ createTheme, themes, md7Themes }, { createMotion }] =
    await Promise.all([
      import('@mk7s/holocss/theme'),
      import('@mk7s/holocss/motion'),
    ]);
  const root = document.documentElement;
  const theme = createTheme(root, { defaultTheme: 'auto' });
  const motion = createMotion(root);
  const labels = new Map<string, string>([
    ...Object.entries(builtInLabels),
    ...md7Themes.map((t) => [t.id, t.name] as [string, string]),
  ]);
  const list = themes.map((id) => ({ id, label: labels.get(id) ?? id }));
  const publish = () => {
    preferences.value = {
      theme: theme.value.theme,
      themes: list,
      setTheme: (value) => theme.set(value),
      motion: motion.value.preference,
      motionAllowed: motion.value.allowed,
      setMotion: (value) => motion.set(value),
    };
  };
  theme.subscribe(() => {
    // VitePress's own styles and code highlighting follow the `dark` class.
    root.classList.toggle('dark', root.dataset.appearance === 'dark');
    publish();
  });
  motion.subscribe(publish);
}
