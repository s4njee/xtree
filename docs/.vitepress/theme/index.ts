import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import '@mk7s/holocss/components.css';
import EffectDemo from './EffectDemo.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  async enhanceApp({ app }) {
    app.component('EffectDemo', EffectDemo);
    if (import.meta.env.SSR) return;
    // Follow `auto` (OS light/dark/contrast) and other tabs, keeping VitePress's
    // `dark` class in step with the resolved HoloCSS palette.
    const { createTheme } = await import('@mk7s/holocss/theme');
    const root = document.documentElement;
    createTheme(root).subscribe(() => {
      root.classList.toggle('dark', root.dataset.appearance === 'dark');
    });
  },
} satisfies Theme;
