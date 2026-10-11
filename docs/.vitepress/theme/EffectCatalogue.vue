<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { withBase } from 'vitepress';
import effects from '../effects-meta.json';
import { startPreview } from './gallery-preview';

/**
 * The effect catalogue and gallery (X19.16, X19.17): a still of every effect,
 * grouped by family and filtered on the client as you change the filters.
 */
type Entry = (typeof effects)[number];

const family = ref('all');
const kind = ref('all');
const cost = ref('all');
const buffers = ref('all');
const stillOnly = ref(false);

const families = [
  ...new Map(effects.map((e) => [e.family, e.familyTitle])).entries(),
];
const kinds = {
  all: 'All',
  post: 'Post',
  material: 'Material',
  transition: 'Transition',
};
const costs: Record<string, string> = {
  all: 'Any cost',
  merged: 'Merges into a shared pass',
  pass: 'Its own pass',
  multipass: 'Several passes',
};
const bufferOptions: Record<string, string> = {
  all: 'Any buffers',
  none: 'No geometry buffers',
  depth: 'Reads depth',
  normal: 'Reads normals',
};
const costLabels: Record<string, string> = {
  merged: 'merges',
  pass: '1 pass',
  multipass: 'multi-pass',
};

const matches = (e: Entry) =>
  (family.value === 'all' || e.family === family.value) &&
  (kind.value === 'all' || e.kind === kind.value) &&
  (cost.value === 'all' || e.cost === cost.value) &&
  (buffers.value === 'all' ||
    (buffers.value === 'none'
      ? e.buffers.length === 0
      : (e.buffers as string[]).includes(buffers.value))) &&
  (!stillOnly.value || e.motion === 'static');

const shown = computed(() => effects.filter(matches));
const groups = computed(() =>
  families
    .map(([id, title]) => ({
      id,
      title,
      effects: shown.value.filter((e) => e.family === id),
    }))
    .filter((group) => group.effects.length),
);
const filtered = computed(
  () =>
    family.value !== 'all' ||
    kind.value !== 'all' ||
    cost.value !== 'all' ||
    buffers.value !== 'all' ||
    stillOnly.value,
);

// Hover previews: only fine, hover-capable pointers, after a short pause so
// sweeping across the grid doesn't start them.
let hoverTimer = 0;
let stopPreview: (() => void) | null = null;
let hovered: HTMLElement | null = null;
function enter(event: PointerEvent, effect: Entry) {
  if (event.pointerType !== 'mouse') return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const card = event.currentTarget as HTMLElement;
  const media = card.querySelector<HTMLElement>('.xt-effect-media')!;
  hovered = card;
  clearTimeout(hoverTimer);
  hoverTimer = window.setTimeout(async () => {
    stopPreview?.();
    stopPreview = null;
    const stop = await startPreview(media, effect.id, effect.kind);
    if (hovered === card) stopPreview = stop;
    else stop();
  }, 250);
}
function leave() {
  hovered = null;
  clearTimeout(hoverTimer);
  stopPreview?.();
  stopPreview = null;
}
onBeforeUnmount(leave);

function clear() {
  family.value = kind.value = cost.value = buffers.value = 'all';
  stillOnly.value = false;
}
</script>

<template>
  <div class="xt-catalogue hcss-components">
    <form class="xt-catalogue-filters" role="search" @submit.prevent>
      <label class="hcss-field">
        <span class="hcss-label">Family</span>
        <select v-model="family" class="hcss-select">
          <option value="all">All families</option>
          <option v-for="[id, title] in families" :key="id" :value="id">
            {{ title }}
          </option>
        </select>
      </label>
      <fieldset class="hcss-segmented">
        <legend>Type</legend>
        <label v-for="(label, value) in kinds" :key="value">
          <input v-model="kind" type="radio" name="xt-kind" :value="value" />
          {{ label }}
        </label>
      </fieldset>
      <label class="hcss-field">
        <span class="hcss-label">Cost</span>
        <select v-model="cost" class="hcss-select">
          <option v-for="(label, value) in costs" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </label>
      <label class="hcss-field">
        <span class="hcss-label">Buffers</span>
        <select v-model="buffers" class="hcss-select">
          <option
            v-for="(label, value) in bufferOptions"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select>
      </label>
      <label class="hcss-choice">
        <input
          v-model="stillOnly"
          class="hcss-switch"
          type="checkbox"
          role="switch"
        />
        Still effects only
      </label>
    </form>
    <p class="xt-catalogue-count" role="status">
      {{ shown.length }} of {{ effects.length }} effects
      <button
        v-if="filtered"
        class="hcss-button"
        data-variant="ghost"
        data-size="sm"
        type="button"
        @click="clear"
      >
        Clear filters
      </button>
    </p>
    <section
      v-for="group in groups"
      :key="group.id"
      :aria-labelledby="`family-${group.id}`"
    >
      <h2 :id="`family-${group.id}`" tabindex="-1">
        {{ group.title }}
        <a
          class="header-anchor"
          :href="`#family-${group.id}`"
          aria-hidden="true"
        ></a>
      </h2>
      <div class="xt-effect-grid">
        <a
          v-for="effect in group.effects"
          :key="effect.id"
          class="hcss-card xt-effect-card"
          :href="withBase(`/effects/${effect.id}`)"
          :data-effect="effect.id"
          @pointerenter="enter($event, effect)"
          @pointerleave="leave"
        >
          <span class="xt-effect-media">
            <img
              class="xt-effect-thumb"
              :src="withBase(`/thumbnails/${effect.id}.png`)"
              alt=""
              width="320"
              height="180"
              loading="lazy"
              decoding="async"
            />
          </span>
          <strong>{{ effect.title }}</strong>
          <span>{{ effect.summary }}</span>
          <span class="xt-effect-tags">
            <span v-if="effect.kind !== 'post'">{{ effect.kind }}</span>
            <span v-if="effect.cost !== 'none'">{{
              costLabels[effect.cost]
            }}</span>
            <span v-for="b in effect.buffers" :key="b">{{
              b === 'normal' ? 'normals' : b
            }}</span>
            <span v-if="effect.motion !== 'static'">animated</span>
          </span>
        </a>
      </div>
    </section>
  </div>
</template>
