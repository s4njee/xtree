<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * A scroll-driven timeline (X14.2): scrolling the panel scrubs a timeline of
 * parameter changes across bloom, chromatic aberration, film grain,
 * monochrome and a vignette. Nothing moves unless you scroll.
 */
const scroller = ref<HTMLElement>();
const host = ref<HTMLElement>();
const progress = ref(0);
const failed = ref(false);
let teardown: (() => void) | null = null;
let cancelled = false;

onMounted(async () => {
  const element = host.value!;
  await new Promise<void>((resolve) => {
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(element);
  });
  if (cancelled) return;
  if (!document.createElement('canvas').getContext('webgl2')) {
    failed.value = true;
    return;
  }
  const [
    three,
    core,
    scenes,
    animation,
    bloom,
    aberration,
    grain,
    mono,
    vignette,
  ] = await Promise.all([
    import('three'),
    import('@mk7s/xtree/core'),
    import('@xtree/scenes'),
    import('@mk7s/xtree/animation'),
    import('@mk7s/xtree/effects/bloom'),
    import('@mk7s/xtree/effects/chromatic-aberration'),
    import('@mk7s/xtree/effects/film-grain'),
    import('@mk7s/xtree/effects/monochrome'),
    import('@mk7s/xtree/effects/vignette'),
  ]);
  if (cancelled) return;
  const renderer = new three.WebGLRenderer({ antialias: false });
  renderer.toneMapping = three.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  element.append(renderer.domElement);
  const studio = scenes.createStudio(16 / 9);
  const composer = new core.EffectComposer(renderer, { maxPixels: 600_000 });
  composer.setScene(studio.scene, studio.camera);
  const glow = bloom.bloom({ intensity: 0 });
  const fringe = aberration.chromaticAberration({ offset: 0 });
  const film = grain.filmGrain({ intensity: 0, animated: false });
  const grey = mono.monochrome({ amount: 0 });
  const edge = vignette.vignette({ darkness: 0 });
  composer.add(glow, fringe, film, grey, edge);
  const story = animation.timeline([
    {
      target: glow,
      keyframes: [
        { at: 0, values: { intensity: 0 } },
        { at: 0.3, values: { intensity: 1.4 }, easing: 'ease-in-out' },
        { at: 0.7, values: { intensity: 0.5 } },
      ],
    },
    {
      target: fringe,
      keyframes: [
        { at: 0.25, values: { offset: 0 } },
        { at: 0.55, values: { offset: 0.02 }, easing: 'ease-out' },
        { at: 0.8, values: { offset: 0.005 } },
      ],
    },
    {
      target: film,
      keyframes: [
        { at: 0.4, values: { intensity: 0 } },
        { at: 0.7, values: { intensity: 0.12 } },
      ],
    },
    {
      target: grey,
      keyframes: [
        { at: 0.65, values: { amount: 0 } },
        { at: 1, values: { amount: 1 }, easing: 'ease-in' },
      ],
    },
    {
      target: edge,
      keyframes: [
        { at: 0, values: { darkness: 0 } },
        { at: 1, values: { darkness: 0.9 } },
      ],
    },
  ]);
  let frame = 0;
  const draw = () => {
    frame = 0;
    progress.value = story.progress;
    composer.render(0);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  // The timeline drives the parameters; this panel's own scroll drives the timeline.
  const stopScroll = animation.bindScroll(
    {
      get progress() {
        return story.progress;
      },
      set progress(value: number) {
        story.progress = value;
        schedule();
      },
    },
    { scroller: scroller.value! },
  );
  const resize = () => {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    studio.resize(width / height);
    schedule();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  resize();
  teardown = () => {
    stopScroll();
    observer.disconnect();
    cancelAnimationFrame(frame);
    composer.dispose();
    studio.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
});

onBeforeUnmount(() => {
  cancelled = true;
  teardown?.();
});
</script>

<template>
  <div class="xt-scroll-story">
    <div
      ref="scroller"
      class="xt-scroll-story-scroller"
      tabindex="0"
      aria-label="Scroll this panel to scrub the effects timeline"
    >
      <div class="xt-scroll-story-sticky">
        <div ref="host" class="xt-scroll-story-canvas" />
        <p class="xt-scroll-story-progress" role="status">
          <template v-if="failed">This demo needs WebGL2.</template>
          <template v-else
            >Timeline at {{ Math.round(progress * 100) }}% — scroll the
            panel</template
          >
        </p>
      </div>
      <div class="xt-scroll-story-track" />
    </div>
  </div>
</template>

<style scoped>
.xt-scroll-story-scroller {
  height: 360px;
  overflow-y: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overscroll-behavior: contain;
}
.xt-scroll-story-sticky {
  position: sticky;
  top: 0;
  height: 360px;
  display: flex;
  flex-direction: column;
}
.xt-scroll-story-canvas {
  flex: 1;
  min-height: 0;
}
.xt-scroll-story-canvas :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
.xt-scroll-story-progress {
  margin: 0;
  padding: 6px 12px;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
}
.xt-scroll-story-track {
  height: 1400px;
}
</style>
