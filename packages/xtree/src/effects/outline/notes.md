### Selection outlines

With a mask, the outline traces the mask instead of the geometry: give it a selection to outline chosen objects, and add `xray: true` to keep the outline visible through objects in front.

```ts
const hover = outline({ color: '#ffd166', thickness: 2 });
hover.mask = { selection: [pickedMesh], xray: true };
```

Without a mask, edges come from depth and, unless `edges` is `depth`, from a normal prepass. Both tests use second differences, so flat floors at grazing angles and smoothly curved surfaces stay clean while silhouettes and creases are drawn.
