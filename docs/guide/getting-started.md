# Getting started

::: info Before the first release
`@mk7s/xtree` is not on npm yet. These steps use a local checkout. The composer and the first effects arrive in M1.
:::

## Use the shader chunks

Build the package in a checkout, then add it to your project:

```sh
pnpm install
pnpm build
# in your project
pnpm add @mk7s/xtree@link:../xtree/packages/xtree three
```

Include chunks in your own `ShaderMaterial` and let `resolveIncludes` assemble them:

```ts
import * as THREE from 'three';
import { resolveIncludes } from '@mk7s/xtree/glsl';
import { noise } from '@mk7s/xtree/shaders/noise';

const { code } = resolveIncludes(
  /* glsl */ `
  #include <xtree/noise/fbm>
  uniform float time;
  varying vec2 vUv;
  void main() {
    float n = xt_fbm(vec3(vUv * 4.0, time * 0.1), 5, 2.0, 0.5);
    gl_FragColor = vec4(vec3(n * 0.5 + 0.5), 1.0);
  }`,
  noise,
);

const material = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader:
    'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: code,
});
```

`resolveIncludes` expands each xtree chunk once and leaves three.js includes such as `<common>` alone. When a shader fails to compile, pass the info log and the returned `files` to `formatShaderError` to get `chunk:line` locations. See the [shader chunk reference](/reference/shaders) for every function.

## Work on xtree

```sh
pnpm install
pnpm check          # format, lint, GLSL lint, credits, types, build, size, docs freshness, unit tests
pnpm test:browser   # GPU tests in Chromium (XT_BROWSERS=chromium,firefox,webkit for all)
pnpm docs:dev       # this site, with HoloCSS fetched at the pinned commit
```

Requires Node 22.12 or newer and pnpm 11. `pnpm glsl:lint` compiles every chunk when `glslangValidator` is installed (`apt install glslang-tools`).
