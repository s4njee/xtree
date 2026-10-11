# Architecture decisions

Each record states the context, the decision and its consequences, in the HoloCSS ADR style. Records change status rather than being rewritten; a superseding record links back.

| Record                                    | Decision                                                                                                            | Status                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| [0001](./0001-package-layout)             | pnpm workspace: library package plus private VitePress package; TypeScript 6                                        | Accepted                     |
| [0002](./0002-composer-and-merging)       | Own composer that merges compatible effects; runtime include resolution                                             | Accepted, to be proven in M1 |
| [0003](./0003-webgl2-first)               | WebGL2 and GLSL ES 3.00 first; keep shaders portable to TSL                                                         | Accepted                     |
| [0004](./0004-three-peer-range)           | `three` is an external peer, `>=0.180.0 <0.187.0`, matching HoloCSS                                                 | Accepted                     |
| [0005](./0005-holocss-relationship)       | HoloCSS is an optional peer; docs read pinned HoloCSS source until it publishes                                     | Accepted                     |
| [0006](./0006-licensing-and-credits)      | MIT; every shader records its provenance; no NC/SA/GPL sources                                                      | Accepted                     |
| [0007](./0007-effect-authoring)           | One declaration per effect, `$` namespacing, uniform vs structural parameters, three.js-free effect modules         | Accepted                     |
| [0008](./0008-geometry-buffers-and-masks) | Effects declare depth and normal buffers; every effect takes a texture, depth or selection mask                     | Accepted                     |
| [0009](./0009-transitions-and-holocss)    | xtree transitions target HoloCSS's `ThreeEffect` contract through `toHoloEffect`; HoloCSS keeps its seven built-ins | Accepted                     |
