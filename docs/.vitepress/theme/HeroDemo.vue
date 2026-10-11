<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';

/**
 * The landing page hero (X19.6): a slowly turning studio under holographic
 * foil, bloom and a vignette. It shows a static poster first and loads
 * three.js only after the page has loaded and gone idle, and only when it is
 * on screen. It follows the HoloCSS theme and motion settings.
 */
const host = ref<HTMLElement>();
const live = ref(false);
let teardown: (() => void) | null = null;
let cancelled = false;

function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    const idle = () =>
      'requestIdleCallback' in window
        ? window.requestIdleCallback(() => resolve(), { timeout: 2000 })
        : setTimeout(resolve, 200);
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });
}

function whenVisible(element: Element): Promise<void> {
  return new Promise((resolve) => {
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(element);
  });
}

async function start(element: HTMLElement) {
  await whenIdle();
  await whenVisible(element);
  if (cancelled || !document.createElement('canvas').getContext('webgl2'))
    return;
  const [three, core, scenes, holo, foil, bloom, vignette] = await Promise.all([
    import('three'),
    import('@mk7s/xtree/core'),
    import('@xtree/scenes'),
    import('@mk7s/xtree/holocss'),
    import('@mk7s/xtree/effects/holographic-foil'),
    import('@mk7s/xtree/effects/bloom'),
    import('@mk7s/xtree/effects/vignette'),
  ]);
  if (cancelled) return;
  const renderer = new three.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.toneMapping = three.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  const studio = scenes.createStudio(16 / 10);
  // A decorative hero: a modest resolution keeps bloom cheap.
  const composer = new core.EffectComposer(renderer, {
    maxDpr: 1.5,
    maxPixels: 600_000,
  });
  // On a software renderer (no GPU acceleration) every frame blocks the main
  // thread, so the hero shows one live still instead of animating.
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const software = /swiftshader|llvmpipe|softpipe|software/i.test(
    String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '',
    ),
  );
  composer.setScene(studio.scene, studio.camera);
  const effects = [
    foil.holographicFoil({ preset: 'card', intensity: 0.55 }),
    bloom.bloom({ intensity: 0.6 }),
    vignette.vignette(),
  ];
  composer.add(...effects);
  const unbindTheme = holo.bindTheme(effects, element);
  let raf = 0;
  let time = 0;
  let last = performance.now();
  let started = false;
  let allowed = true;
  // Frames that took too long; after a few the hero stops animating.
  let slow = 0;
  let animate = !software;
  const unbindMotion = holo.bindMotion(
    {
      setMotion(value: boolean) {
        allowed = value;
        composer.motion = value;
        if (value && started && animate) loop();
      },
    },
    element,
  );
  composer.play();
  const draw = (now: number) => {
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    const start = performance.now();
    if (allowed) time += delta * 0.35;
    studio.update(time);
    studio.camera.position.set(
      Math.sin(time * 0.2) * 7,
      1.7,
      Math.cos(time * 0.2) * 7,
    );
    studio.camera.lookAt(0, 0.8, 0);
    composer.render(allowed ? delta : 0);
    if (performance.now() - start > 40 && ++slow >= 3) animate = false;
  };
  // About 30 frames a second is plenty for a slow turn.
  let lastDrawn = 0;
  const frame = (now: number) => {
    raf = 0;
    if (now - lastDrawn >= 30) {
      lastDrawn = now;
      draw(now);
    }
    if (allowed && animate && onScreen && !document.hidden) loop();
  };
  function loop() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }
  const resize = () => {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    studio.resize(width / height);
    draw(performance.now());
  };
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  let onScreen = true;
  const visibility = new IntersectionObserver((entries) => {
    onScreen = Boolean(entries[0]?.isIntersecting);
    if (onScreen && allowed && animate) loop();
  });
  visibility.observe(element);
  const onVisibility = () => !document.hidden && allowed && animate && loop();
  document.addEventListener('visibilitychange', onVisibility);
  element.append(canvas);
  resize();
  live.value = true;
  started = true;
  if (allowed && animate) loop();
  teardown = () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    visibility.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    unbindTheme();
    unbindMotion();
    composer.dispose();
    studio.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}

onMounted(() => {
  if (host.value) void start(host.value);
});
onBeforeUnmount(() => {
  cancelled = true;
  teardown?.();
});
</script>

<template>
  <div ref="host" class="xt-hero" :class="{ 'xt-hero-live': live }">
    <img
      class="xt-hero-poster"
      :src="withBase('/thumbnails/holographic-foil.png')"
      alt="The xtree studio scene under holographic foil"
      width="320"
      height="180"
      fetchpriority="low"
    />
  </div>
</template>
