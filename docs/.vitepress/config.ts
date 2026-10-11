import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
// @ts-expect-error The setup script is plain JavaScript.
import { ensureHolocss } from '../../scripts/holocss.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const holocss: string = ensureHolocss();

/** Deploy path. Defaults to mk7s.dev/xtree/; override with XT_DOCS_BASE (for example "/" for local previews). */
const base = process.env.XT_DOCS_BASE ?? '/xtree/';

// HoloCSS's classic theme bootstrap restores the stored theme before first
// paint. xtree defaults to `auto` and mirrors the resolved appearance onto the
// `dark` class that VitePress's own styles (and code highlighting) use.
const bootstrap = buildSync({
  entryPoints: [resolve(holocss, 'src/theme/bootstrap.ts')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
}).outputFiles[0]!.text;
const themeScript = [
  "document.documentElement.dataset.hcssTheme??='auto';",
  bootstrap.trim(),
  "document.documentElement.classList.toggle('dark',document.documentElement.dataset.appearance==='dark');",
].join('');

export default defineConfig({
  title: 'xtree',
  description: 'A comprehensive, tree-shakeable effects library for three.js.',
  base,
  cleanUrls: true,
  appearance: false,
  lastUpdated: false,
  head: [
    [
      'link',
      { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` },
    ],
    ['script', {}, themeScript],
  ],
  sitemap: { hostname: `https://mk7s.dev${base}` },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
      {
        text: 'Shaders',
        link: '/reference/shaders',
        activeMatch: '^/reference/',
      },
      { text: 'Project', link: '/project/', activeMatch: '^/(project|adr)/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Getting started', link: '/guide/getting-started' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [{ text: 'Shader chunks', link: '/reference/shaders' }],
        },
      ],
      '/project/': projectSidebar(),
      '/adr/': projectSidebar(),
    },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/s4njee/xtree' }],
    footer: { message: 'MIT Licensed. Styled with HoloCSS.' },
  },
  vite: {
    resolve: {
      alias: [
        {
          find: /^@mk7s\/holocss\/components\.css$/,
          replacement: resolve(holocss, 'src/components/index.css'),
        },
        {
          find: /^@mk7s\/holocss\/theme$/,
          replacement: resolve(holocss, 'src/theme/index.ts'),
        },
      ],
    },
    server: { fs: { allow: [repoRoot, holocss] } },
  },
});

function projectSidebar() {
  return [
    {
      text: 'Project',
      items: [
        { text: 'Overview and roadmap', link: '/project/' },
        { text: 'M0 validation', link: '/project/m0-validation' },
      ],
    },
    {
      text: 'Decisions',
      items: [
        { text: 'Index', link: '/adr/' },
        {
          text: '0001 Package layout and toolchain',
          link: '/adr/0001-package-layout',
        },
        {
          text: '0002 Composer and effect merging',
          link: '/adr/0002-composer-and-merging',
        },
        {
          text: '0003 WebGL2 first, WebGPU later',
          link: '/adr/0003-webgl2-first',
        },
        {
          text: '0004 three.js peer range',
          link: '/adr/0004-three-peer-range',
        },
        {
          text: '0005 Relationship with HoloCSS',
          link: '/adr/0005-holocss-relationship',
        },
        {
          text: '0006 Licensing and credits',
          link: '/adr/0006-licensing-and-credits',
        },
      ],
    },
  ];
}
