---
layout: home

hero:
  name: xtree
  text: Effects for three.js
  tagline: A comprehensive, tree-shakeable library of post-processing, material and transition effects, styled with HoloCSS.
  actions:
    - theme: brand
      text: Introduction
      link: /guide/
    - theme: alt
      text: Shader chunks
      link: /reference/shaders
    - theme: alt
      text: Roadmap
      link: /project/

features:
  - title: One import per effect
    details: Every effect, material and shader family is its own subpath export with its own size budget, so unused GLSL never reaches your bundle.
  - title: Merged passes
    details: Compatible screen-space effects compile into a single shader pass. Multi-pass effects such as bloom and depth of field merge their final composite step with them.
  - title: Safe by default
    details: Effects respect reduced motion and high contrast. Anything that flashes stays below the WCAG 2.3.1 threshold unless you opt out.
  - title: HoloCSS native
    details: Effect colors follow HoloCSS theme roles, and effects share HoloCSS's motion policy and its one-renderer stage.
---
