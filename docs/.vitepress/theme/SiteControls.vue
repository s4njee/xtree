<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { preferences, startPreferences } from './preferences';

defineProps<{ screen?: boolean }>();
// Rendered after mount only: stored preferences are unknown to the server.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
  void startPreferences();
});
</script>

<template>
  <div
    v-if="mounted"
    class="xt-site-controls hcss-components"
    :class="{ 'xt-site-controls-screen': screen }"
  >
    <label class="xt-site-theme">
      <span class="xt-visually-hidden">Theme</span>
      <select
        class="hcss-select"
        data-size="sm"
        aria-label="Theme"
        :disabled="!preferences"
        :value="preferences?.theme ?? 'auto'"
        @change="
          preferences?.setTheme(($event.target as HTMLSelectElement).value)
        "
      >
        <option
          v-for="theme in preferences?.themes ?? [
            { id: 'auto', label: 'Auto (system)' },
          ]"
          :key="theme.id"
          :value="theme.id"
        >
          {{ theme.label }}
        </option>
      </select>
    </label>
    <label
      class="hcss-choice xt-site-motion"
      :title="
        preferences &&
        !preferences.motionAllowed &&
        preferences.motion === 'auto'
          ? 'Motion is off by your system setting or this theme'
          : undefined
      "
    >
      <input
        class="hcss-switch"
        type="checkbox"
        role="switch"
        :disabled="!preferences"
        :checked="preferences ? preferences.motion === 'auto' : true"
        @change="
          preferences?.setMotion(
            ($event.target as HTMLInputElement).checked ? 'auto' : 'none',
          )
        "
      />
      Motion
    </label>
  </div>
</template>
