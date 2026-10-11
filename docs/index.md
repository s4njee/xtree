---
layout: home
title: xtree
titleTemplate: Effects for three.js

hero:
  name: xtree
  text: Effects for three.js
  tagline: Post-processing, material and transition effects that merge into few passes, follow your theme and respect reduced motion.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Browse the effects
      link: /effects/
    - theme: alt
      text: HoloCSS themes and motion
      link: /guide/holocss
---

<div class="xt-home vp-doc">

## Install in 30 seconds

```sh
npm install @mk7s/xtree three
```

```ts
import { EffectComposer } from '@mk7s/xtree/core';
import { bloom } from '@mk7s/xtree/effects/bloom';
import { vignette } from '@mk7s/xtree/effects/vignette';

const composer = new EffectComposer(renderer);
composer.setScene(scene, camera);
composer.add(bloom(), vignette());
renderer.setAnimationLoop(() => composer.render());
```

Every effect is its own import, so you ship only the GLSL you use. Compatible effects merge into one shader pass. Continue with [getting started](/guide/getting-started), or browse the [effect gallery](/effects/), where every effect has a live demo. A playground for whole stacks is planned for a later milestone.

## Effect families

<FamilyCards />

## Principles

- **One import per effect.** Every effect, material and shader chunk family is a subpath export with its own size budget.
- **Merged passes.** Screen-space effects compile into a single shader where they can. Multi-pass effects such as bloom merge their final composite step.
- **Safe by default.** Effects respect reduced motion and high contrast, and a CI test keeps every animated effect and preset below the WCAG 2.3.1 flash threshold.
- **HoloCSS native.** Effect colors can follow HoloCSS theme roles, and effects share its motion policy. See [HoloCSS themes and motion](/guide/holocss).

</div>
