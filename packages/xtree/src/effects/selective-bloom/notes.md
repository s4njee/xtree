### Selecting what glows

```ts
const glowing = selectiveBloom({ intensity: 1.5 });
glowing.mask = { selection: [sign, lamp] }; // or { selection: { layer: 2 } }
```

The selection is rendered to a mask each frame, so objects in front still hide the selected ones; with `xray: true` they bloom through. Texture masks also work. Depth masks don't limit the bloom source; use a selection or texture instead.
