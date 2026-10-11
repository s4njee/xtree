import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import '@mk7s/holocss/components.css';
import EffectCatalogue from './EffectCatalogue.vue';
import EffectDemo from './EffectDemo.vue';
import FamilyCards from './FamilyCards.vue';
import HeroDemo from './HeroDemo.vue';
import SiteControls from './SiteControls.vue';
import { startPreferences } from './preferences';
import './style.css';

export default {
  extends: DefaultTheme,
  // The HoloCSS theme switcher and motion control replace VitePress's
  // light/dark toggle, in the nav bar and the mobile menu.
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(SiteControls),
      'nav-screen-content-after': () => h(SiteControls, { screen: true }),
      'home-hero-image': () => h(HeroDemo),
    }),
  enhanceApp({ app }) {
    app.component('EffectDemo', EffectDemo);
    app.component('EffectCatalogue', EffectCatalogue);
    app.component('FamilyCards', FamilyCards);
    if (!import.meta.env.SSR) void startPreferences();
  },
} satisfies Theme;
