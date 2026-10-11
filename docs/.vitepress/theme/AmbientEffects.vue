<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

/**
 * A HoloCSS ambient scene through xtree effects (X15.5): HoloCSS's own
 * `scene()` and builders (theme colors, motion policy, visibility), with
 * `withEffects` adding bloom, film grain and holographic foil on the
 * stage's shared renderer.
 */
const host = ref<HTMLElement>();
const builder = ref<'gradient' | 'particles' | 'litObject'>('litObject');
const effects = ref(true);
const failed = ref(false);
let controller: { destroy(): void } | null = null;
let generation = 0;
let visible = false;

async function mount() {
  const run = ++generation;
  controller?.destroy();
  controller = null;
  if (!visible || failed.value) return;
  const [holo, xtree, core, bloom, grain, foil, builders] = await Promise.all([
    import('@mk7s/holocss/three'),
    import('@mk7s/xtree/holocss'),
    import('@mk7s/xtree/core'),
    import('@mk7s/xtree/effects/bloom'),
    import('@mk7s/xtree/effects/film-grain'),
    import('@mk7s/xtree/effects/holographic-foil'),
    Promise.all([
      import('@mk7s/holocss/three/scenes/gradient'),
      import('@mk7s/holocss/three/scenes/particles'),
      import('@mk7s/holocss/three/scenes/object'),
    ]).then(([g, p, o]) => ({
      gradient: g.gradient,
      particles: p.particles,
      litObject: o.litObject,
    })),
  ]);
  if (run !== generation) return;
  const build = builders[builder.value];
  const scene = await holo.scene(
    host.value!,
    effects.value
      ? xtree.withEffects(build, (renderer) =>
          new core.EffectComposer(renderer, { maxPixels: 600_000 }).add(
            foil.holographicFoil({ intensity: 0.45 }),
            bloom.bloom({ intensity: 0.8 }),
            grain.filmGrain({ intensity: 0.08 }),
          ),
        )
      : build,
  );
  if (!scene) {
    failed.value = true;
    return;
  }
  if (run !== generation) scene.destroy();
  else controller = scene;
}

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    if (!entries[0]?.isIntersecting) return;
    observer.disconnect();
    visible = true;
    void mount();
  });
  observer.observe(host.value!);
});
watch([builder, effects], () => void mount());
onBeforeUnmount(() => {
  generation++;
  controller?.destroy();
});
</script>

<template>
  <div class="xt-ambient">
    <div ref="host" class="xt-ambient-stage" aria-hidden="true" />
    <div class="xt-ambient-controls">
      <label
        >Scene
        <select v-model="builder">
          <option value="litObject">litObject</option>
          <option value="particles">particles</option>
          <option value="gradient">gradient</option>
        </select>
      </label>
      <label><input v-model="effects" type="checkbox" /> xtree effects</label>
      <span v-if="failed" role="status">This demo needs WebGL2.</span>
    </div>
  </div>
</template>

<style scoped>
.xt-ambient-stage {
  height: 280px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.xt-ambient-controls {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 8px;
  font-size: 0.9rem;
}
</style>
