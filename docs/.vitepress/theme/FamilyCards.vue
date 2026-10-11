<script setup lang="ts">
import { withBase } from 'vitepress';
import effects from '../effects-meta.json';

/** One card per effect family on the landing page, with a still and a count. */
const families = [
  ...effects
    .reduce((map, effect) => {
      const entry = map.get(effect.family) ?? {
        id: effect.family,
        title: effect.familyTitle,
        first: effect.id,
        names: [] as string[],
      };
      entry.names.push(effect.title);
      return map.set(effect.family, entry);
    }, new Map<string, { id: string; title: string; first: string; names: string[] }>())
    .values(),
];
</script>

<template>
  <div class="xt-effect-grid xt-family-grid">
    <a
      v-for="family in families"
      :key="family.id"
      class="hcss-card xt-effect-card"
      :href="withBase(`/effects/#family-${family.id}`)"
    >
      <img
        class="xt-effect-thumb"
        :src="withBase(`/thumbnails/${family.first}.png`)"
        alt=""
        width="320"
        height="180"
        loading="lazy"
        decoding="async"
      />
      <strong>{{ family.title }}</strong>
      <span
        >{{ family.names.length }}
        {{ family.names.length === 1 ? 'effect' : 'effects' }}:
        {{ family.names.join(', ') }}</span
      >
    </a>
  </div>
</template>
