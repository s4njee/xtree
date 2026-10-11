# Overview and roadmap

The full plan, with every epic and story, is [plan.md](https://github.com/s4njee/xtree/blob/main/plan.md) in the repository. This page tracks the milestones.

| Milestone               | Scope                                                                                      | State                                |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| **M0 — Foundation**     | Tooling, CI, ADRs, shader chunks for noise, color and blending, VitePress with HoloCSS     | Done ([validation](./m0-validation)) |
| **M1 — Vertical slice** | `defineEffect`, composer, effect merging, five effects with generated pages and live demos | Done ([validation](./m1-validation)) |
| **M2 — Alpha**          | All 37 P0 effects, HoloCSS theme and motion integration, safety checks, docs runtime       | Done ([validation](./m2-validation)) |
| **M3 — Beta**           | All 70 P1 effects, materials, interaction, benchmarks, gallery and guides                  | Done ([validation](./m3-validation)) |
| **M4 — Playground**     | Stack editor, StackBlitz export, React Three Fiber adapter                                 | Next                                 |
| **M5 — 1.0**            | At least 100 effects, frozen API, npm release                                              | Planned                              |
| **M6 — WebGPU**         | TSL port, depending on the X21.1 spike                                                     | Planned                              |

Architecture decisions are recorded as [ADRs](/adr/).
