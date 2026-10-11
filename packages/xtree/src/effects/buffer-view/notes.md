### Debugging

Add it last in the stack to see what depth, normal and mask effects read. The `mask` view shows this effect's own mask, so give it the same mask as the effect you are checking:

```ts
composer.add(bufferView({ buffer: 'mask', mask: outlineEffect.mask }));
```

The output stage still applies the renderer's tone mapping; set `renderer.toneMapping = NoToneMapping` to read exact values.
