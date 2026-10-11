import { buildSync } from 'esbuild';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type DefaultTheme } from 'vitepress';
import { glsl } from '../../packages/xtree/build/glsl-plugin.ts';
import effectSidebar from './effects.json' with { type: 'json' };
// @ts-expect-error The setup script is plain JavaScript.
import { ensureHolocss } from '../../scripts/holocss.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const xtreeSource = resolve(repoRoot, 'packages/xtree/src');
const holocss: string = ensureHolocss();

/** Deploy path. Defaults to mk7s.dev/xtree/; override with XT_DOCS_BASE (for example "/" for local previews). */
const base = process.env.XT_DOCS_BASE ?? '/xtree/';
/** Site origin for the sitemap. The Pages workflow sets it to the GitHub Pages URL. */
const origin = (process.env.XT_DOCS_ORIGIN ?? 'https://mk7s.dev').replace(
  /\/$/,
  '',
);

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
  // HoloCSS's motion preference (createMotion), restored before paint too.
  "try{var m=localStorage.getItem('hcss-motion');if(m==='none'||m==='auto')document.documentElement.dataset.hcssMotion=m}catch(e){}",
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
  sitemap: { hostname: `${origin}${base}` },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
      { text: 'Effects', link: '/effects/', activeMatch: '^/effects/' },
      {
        text: 'Shaders',
        link: '/reference/shaders',
        activeMatch: '^/reference/',
      },
      { text: 'API', link: '/api/', activeMatch: '^/api/' },
      { text: 'Project', link: '/project/', activeMatch: '^/(project|adr)/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Masks and geometry buffers', link: '/guide/masks' },
            { text: 'Material effects', link: '/guide/materials' },
            { text: 'Transitions', link: '/guide/transitions' },
            { text: 'HoloCSS themes and motion', link: '/guide/holocss' },
          ],
        },
      ],
      '/effects/': [
        {
          text: 'Effects',
          items: [{ text: 'All effects', link: '/effects/' }],
        },
        ...(effectSidebar as DefaultTheme.SidebarItem[]),
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [{ text: 'Shader chunks', link: '/reference/shaders' }],
        },
      ],
      '/api/': apiSidebar(),
      '/project/': projectSidebar(),
      '/adr/': projectSidebar(),
    },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/s4njee/xtree' }],
    footer: { message: 'MIT Licensed. Styled with HoloCSS.' },
  },
  vite: {
    // The docs run the library from source: effects compile with the same GLSL plugin as the build.
    plugins: [glsl({ minify: false }) as never],
    define: { __XTREE_VERSION__: JSON.stringify('docs') },
    // three.js is one lazily loaded chunk (about 700 kB minified) that only demo pages fetch.
    build: { chunkSizeWarningLimit: 900 },
    resolve: {
      alias: [
        {
          find: /^@mk7s\/xtree$/,
          replacement: resolve(xtreeSource, 'index.ts'),
        },
        {
          find: /^@mk7s\/xtree\/(.+)$/,
          replacement: `${xtreeSource}/$1/index.ts`,
        },
        {
          find: /^@mk7s\/holocss\/runtime$/,
          replacement: resolve(holocss, 'src/runtime/index.ts'),
        },
        {
          find: /^@mk7s\/holocss\/components\.css$/,
          replacement: resolve(holocss, 'src/components/index.css'),
        },
        {
          find: /^@mk7s\/holocss\/theme$/,
          replacement: resolve(holocss, 'src/theme/index.ts'),
        },
        {
          find: /^@mk7s\/holocss\/motion$/,
          replacement: resolve(holocss, 'src/motion/index.ts'),
        },
      ],
    },
    server: { fs: { allow: [repoRoot, holocss] } },
  },
});

/**
 * The API reference sidebar, from the pages TypeDoc writes to docs/api
 * (`pnpm --filter @mk7s/xtree api:docs`, run by the docs build): one
 * collapsible group per entry point, with its classes, functions, types.
 */
function apiSidebar(): DefaultTheme.SidebarItem[] {
  const root = fileURLToPath(new URL('../api/', import.meta.url));
  if (!existsSync(root)) return [];
  const kinds: Record<string, string> = {
    classes: 'Classes',
    functions: 'Functions',
    interfaces: 'Interfaces',
    'type-aliases': 'Types',
    variables: 'Variables',
  };
  const order = [
    'xtree',
    'core',
    'effect',
    'holocss',
    'motion',
    'safety',
    'glsl',
    'shaders',
  ];
  const modules = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return [
    { text: 'API reference', items: [{ text: 'Overview', link: '/api/' }] },
    ...modules.map((module) => ({
      text: module === 'xtree' ? '@mk7s/xtree' : `@mk7s/xtree/${module}`,
      collapsed: true,
      items: [
        { text: 'Overview', link: `/api/${module}/` },
        ...Object.entries(kinds).flatMap(([folder, title]) => {
          const dir = resolve(root, module, folder);
          if (!existsSync(dir)) return [];
          return [
            {
              text: title,
              collapsed: true,
              items: readdirSync(dir)
                .filter((file) => file.endsWith('.md'))
                .sort()
                .map((file) => ({
                  text: file.replace(/\.md$/, ''),
                  link: `/api/${module}/${folder}/${file.replace(/\.md$/, '')}`,
                })),
            },
          ];
        }),
      ],
    })),
  ];
}

function projectSidebar() {
  return [
    {
      text: 'Project',
      items: [
        { text: 'Overview and roadmap', link: '/project/' },
        { text: 'M0 validation', link: '/project/m0-validation' },
        { text: 'M1 validation', link: '/project/m1-validation' },
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
        {
          text: '0007 Effect authoring contract',
          link: '/adr/0007-effect-authoring',
        },
        {
          text: '0008 Geometry buffers and masks',
          link: '/adr/0008-geometry-buffers-and-masks',
        },
        {
          text: '0009 Transitions and HoloCSS',
          link: '/adr/0009-transitions-and-holocss',
        },
      ],
    },
  ];
}
