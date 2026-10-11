### Selecting what glows

```ts
const highlight = glow({ preset: 'hover' });
highlight.mask = { selection: [hoveredMesh] };
```

The halo is a blur of the mask at half resolution, so it costs the same however many objects are selected. Texture masks work too; depth masks aren't used as a glow source.
