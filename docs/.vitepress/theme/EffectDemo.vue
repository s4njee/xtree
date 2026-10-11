<script setup lang="ts">
import type {
  Effect,
  MaterialEffect,
  EffectFactory,
  Param,
  ParamSchema,
} from '@mk7s/xtree/effect';
import { labelFor } from '@mk7s/xtree/effect';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { withBase } from 'vitepress';
import { effectLoaders } from './effect-registry';

const props = defineProps<{ effect: string }>();

type Definition = EffectFactory<ParamSchema>['definition'];
type Value = number | boolean | string | null | readonly unknown[];

const root = ref<HTMLElement>();
const stage = ref<HTMLElement>();
const status = ref<'loading' | 'ready' | 'unsupported' | 'error'>('loading');
const errorMessage = ref('');
const definition = shallowRef<Definition | null>(null);
const values = reactive<Record<string, Value>>({});
const playing = ref(true);
const motion = ref(true);
const compare = ref(false);
/** Material effects are patched into the studio's materials instead of the composer. */
const isMaterial = computed(() => definition.value?.kind === 'material');
/** Transitions play between two views of the studio instead of post-processing it. */
const isTransition = computed(() => definition.value?.kind === 'transition');
const transitionProgress = ref(0.5);
/** Effects that run in the composer and take masks. */
const isPost = computed(() => !isMaterial.value && !isTransition.value);
const divider = ref(50);
const followPointer = ref(true);
const pointerParams = ['tilt', 'center'];
const passes = ref(0);
const copied = ref(false);
/** Which code tab shows: plain three.js, or with the HoloCSS helpers. */
const codeTab = ref<'three' | 'holocss'>('three');
/** The stats overlay (FPS, GPU time, draws, programs); off by default. */
const stats = ref(false);
/** The preset last applied, which the URL records with any changes since. */
const activePreset = ref<string | null>(null);
/**
 * Theme-aware colors the visitor set (or a preset set), which stop
 * following the HoloCSS theme.
 */
const themeOverrides = ref<string[]>([]);
type MaskChoice = 'none' | 'selection' | 'xray' | 'distance';
const maskChoice = ref<MaskChoice>('none');
const maskOptions: Record<MaskChoice, string> = {
  none: 'None',
  selection: 'Selection',
  xray: 'X-ray',
  distance: 'Distance',
};

let effect: Effect | null = null;
let findObject: (name: string) => unknown = () => undefined;
let requestRender = () => {};
let teardown: (() => void) | null = null;
let rebindTheme = () => {};
/** The URL is written only after the demo has read it on load. */
let urlReady = false;
let setStats = (_on: boolean) => {};

const paramEntries = computed(
  () => Object.entries(definition.value?.params ?? {}) as [string, Param][],
);
const presetNames = computed(() =>
  Object.keys(definition.value?.presets ?? {}),
);
/** Studio objects the selection mask picks: the effect's demo selection, or the knot. */
const selectionNames = computed(
  () => definition.value?.meta.demo?.selection ?? ['knot'],
);

/** Color parameters that follow the HoloCSS theme through bindTheme(). */
const themedParams = computed(() =>
  paramEntries.value
    .filter(
      ([name, param]) =>
        param.kind === 'color' &&
        param.theme &&
        !themeOverrides.value.includes(name),
    )
    .map(([name]) => name),
);

/** Parameter values a URL or the code panel compares with: the defaults, plus the active preset. */
function baseline(): Record<string, unknown> {
  const def = definition.value;
  if (!def) return {};
  return {
    ...Object.fromEntries(
      Object.entries(def.params).map(([name, p]) => [name, p.default]),
    ),
    ...(activePreset.value ? def.presets?.[activePreset.value] : {}),
  };
}

/** Records the demo state in the URL (`?preset=…&name=value`) without a navigation. */
function writeUrl() {
  const def = definition.value;
  if (!def || !urlReady) return;
  const url = new URL(window.location.href);
  for (const key of [...url.searchParams.keys()]) url.searchParams.delete(key);
  if (activePreset.value) url.searchParams.set('preset', activePreset.value);
  const base = baseline();
  for (const [name] of paramEntries.value) {
    if (themedParams.value.includes(name)) continue;
    if (sameValue(values[name], base[name])) continue;
    const value = values[name];
    url.searchParams.set(
      name,
      typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value),
    );
  }
  if (isPost.value && maskChoice.value !== defaultMask())
    url.searchParams.set('mask', maskChoice.value);
  window.history.replaceState(window.history.state, '', url);
}

/** Parses a URL value for a parameter; undefined when it doesn't fit. */
function parseValue(param: Param, raw: string): Value | undefined {
  switch (param.kind) {
    case 'float':
    case 'int': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'bool':
      return raw === 'true' ? true : raw === 'false' ? false : undefined;
    case 'vec2':
    case 'vec3':
    case 'gradient':
    case 'curve':
      try {
        return JSON.parse(raw) as Value;
      } catch {
        return undefined;
      }
    case 'texture':
      return raw === 'null' ? null : raw;
    default:
      return raw;
  }
}

/** Applies `?preset=…&name=value&mask=…` from the URL. */
function readUrl() {
  const def = definition.value;
  if (!def || !effect) return;
  const query = new URLSearchParams(window.location.search);
  const preset = query.get('preset');
  if (preset && def.presets?.[preset]) applyPreset(preset);
  for (const [name, raw] of query) {
    const param = def.params[name] as Param | undefined;
    if (!param) continue;
    const value = parseValue(param, raw);
    if (value !== undefined) setParam(name, value);
  }
  const mask = query.get('mask');
  if (isPost.value && mask && mask in maskOptions) setMask(mask as MaskChoice);
}

function defaultMask(): MaskChoice {
  return definition.value?.meta.demo?.selection ? 'selection' : 'none';
}

function maskFor(choice: MaskChoice) {
  if (choice === 'distance') return { depth: [9, 1000], feather: 2 } as const;
  if (choice === 'none') return null;
  return {
    selection: selectionNames.value.map(findObject),
    ...(choice === 'xray' ? { xray: true } : {}),
  };
}

function setMask(choice: MaskChoice) {
  maskChoice.value = choice;
  if (!effect) return;
  effect.mask = maskFor(choice) as never;
  requestRender();
  writeUrl();
}

const factoryName = computed(() =>
  props.effect.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
);
const fieldId = (name: string, suffix = '') =>
  `xt-${props.effect}-${name}${suffix}`;

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  return a === b;
}

function literal(value: Value): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return String(Number(value.toFixed(4)));
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value))
    return `[${value
      .map((v) =>
        Array.isArray(v)
          ? literal(v as Value)
          : typeof v === 'number'
            ? Number(v.toFixed(3))
            : `'${String(v)}'`,
      )
      .join(', ')}]`;
  return String(value);
}

const code = computed(() => {
  const def = definition.value;
  if (!def) return '';
  const holo = codeTab.value === 'holocss';
  // With HoloCSS, theme-aware colors come from bindTheme() instead.
  const themed = holo ? themedParams.value : [];
  const changed = paramEntries.value
    .filter(
      ([name, param]) =>
        !themed.includes(name) && !sameValue(values[name], param.default),
    )
    .map(([name]) => `${name}: ${literal(values[name]!)}`);
  const helpers = holo
    ? [
        ...(themed.length ? ['bindTheme'] : []),
        ...(def.motion && def.motion !== 'static' ? ['bindMotion'] : []),
      ]
    : [];
  const holoImports = helpers.length
    ? [`import { ${helpers.join(', ')} } from '@mk7s/xtree/holocss';`]
    : [];
  const mask = {
    none: '',
    selection: `mask: { selection: ${selectionNames.value.length === 1 ? '[hero]' : 'hero'} }`,
    xray: `mask: { selection: ${selectionNames.value.length === 1 ? '[hero]' : 'hero'}, xray: true }`,
    distance: 'mask: { depth: [9, 1000], feather: 2 }',
  }[maskChoice.value];
  const all = mask && !isMaterial.value ? [...changed, mask] : changed;
  const options = all.length ? `{ ${all.join(', ')} }` : '';
  if (isTransition.value) {
    if (holo)
      return [
        "import { transition3d } from '@mk7s/holocss/three';",
        "import { toHoloEffect } from '@mk7s/xtree/core';",
        `import { ${factoryName.value} } from '@mk7s/xtree/effects/${props.effect}';`,
        '',
        `const effect = ${factoryName.value}(${options});`,
        '// HoloCSS supplies the theme accent and the motion policy.',
        'await transition3d(fromElement, toElement, toHoloEffect(effect), {',
        '  target,',
        '  update: () => swapContent(),',
        '});',
      ].join('\n');
    return [
      "import { createTransition } from '@mk7s/xtree/core';",
      `import { ${factoryName.value} } from '@mk7s/xtree/effects/${props.effect}';`,
      '',
      `const effect = ${factoryName.value}(${options});`,
      'const player = createTransition(renderer, effect, { from: textureA, to: textureB });',
      `player.progress = ${Number(transitionProgress.value.toFixed(2))};`,
      'player.render();',
    ].join('\n');
  }
  if (isMaterial.value) {
    const targets = selectionNames.value
      .map((n) => `scene.getObjectByName('${n}').material`)
      .join(', ');
    return [
      "import { patchMaterial } from '@mk7s/xtree/core';",
      `import { ${factoryName.value} } from '@mk7s/xtree/effects/${props.effect}';`,
      ...holoImports,
      '',
      `const effect = ${factoryName.value}(${options});`,
      `for (const material of [${targets}])`,
      '  patchMaterial(material, effect);',
      ...(holo && themed.length
        ? ['bindTheme(effect, renderer.domElement);']
        : []),
      ...(holo && def.motion && def.motion !== 'static'
        ? ['bindMotion(effect, renderer.domElement);']
        : []),
      'const clock = new THREE.Clock();',
      'renderer.setAnimationLoop(() => {',
      '  effect.tick(clock.getDelta());',
      '  renderer.render(scene, camera);',
      '});',
    ].join('\n');
  }
  return [
    "import { EffectComposer } from '@mk7s/xtree/core';",
    `import { ${factoryName.value} } from '@mk7s/xtree/effects/${props.effect}';`,
    ...holoImports,
    '',
    'const composer = new EffectComposer(renderer);',
    'composer.setScene(scene, camera);',
    ...(maskChoice.value === 'selection' || maskChoice.value === 'xray'
      ? [
          `const hero = ${
            selectionNames.value.length === 1
              ? `scene.getObjectByName('${selectionNames.value[0]}')`
              : `[${selectionNames.value.map((n) => `scene.getObjectByName('${n}')`).join(', ')}]`
          };`,
        ]
      : []),
    ...(holo && themed.length
      ? [
          `const effect = ${factoryName.value}(${options});`,
          'composer.add(effect);',
          'bindTheme(effect, renderer.domElement);',
        ]
      : [`composer.add(${factoryName.value}(${options}));`]),
    ...(def.motion && def.motion !== 'static'
      ? [
          ...(holo ? ['bindMotion(composer, renderer.domElement);'] : []),
          'composer.play();',
        ]
      : []),
    'renderer.setAnimationLoop(() => composer.render());',
  ].join('\n');
});

function format(param: Param, value: Value): string {
  if (typeof value !== 'number') return String(value);
  const step = 'step' in param && param.step ? param.step : 0.01;
  const decimals = Math.max(0, Math.min(4, Math.ceil(-Math.log10(step))));
  const unit = 'unit' in param && param.unit ? ` ${param.unit}` : '';
  return `${value.toFixed(decimals)}${unit}`;
}

function stepOf(param: Param): number {
  if ('step' in param && param.step) return param.step;
  return param.kind === 'int'
    ? 1
    : 'min' in param
      ? (param.max - param.min) / 100
      : 0.01;
}

/** Fill of a HoloCSS slider track, as a percentage. */
function fill(param: Param, value: number): Record<string, string> {
  if (!('min' in param)) return {};
  const percent = ((value - param.min) / (param.max - param.min)) * 100;
  return { '--hcss-slider-end': `${Math.max(0, Math.min(100, percent))}%` };
}

function optionLabel(param: Param, option: string): string {
  return (
    (param.kind === 'select' && param.optionLabels?.[option as never]) ||
    labelFor(option)
  );
}

function setParam(name: string, value: Value) {
  if (!effect) return;
  try {
    effect.set({ [name]: value } as never);
  } catch {
    return;
  }
  values[name] = Array.isArray(value) ? [...value] : value;
  // A color the visitor picks stops following the theme.
  if (themedParams.value.includes(name)) {
    themeOverrides.value = [...themeOverrides.value, name];
    rebindTheme();
  }
  requestRender();
  writeUrl();
}

function setComponent(name: string, index: number, component: number) {
  const next = [...(values[name] as number[])];
  next[index] = component;
  setParam(name, next);
}

function syncValues() {
  if (!effect || !definition.value) return;
  for (const name of Object.keys(definition.value.params)) {
    const value = effect.get(name) as Value;
    values[name] = Array.isArray(value) ? [...value] : value;
  }
}

function applyPreset(name: string) {
  if (!effect) return;
  effect.applyPreset(name);
  activePreset.value = name;
  // Colors the preset sets win over the theme; the rest follow it again.
  const preset = definition.value?.presets?.[name] ?? {};
  themeOverrides.value = Object.keys(preset).filter(
    (key) => definition.value?.params[key]?.kind === 'color',
  );
  rebindTheme();
  syncValues();
  requestRender();
  writeUrl();
}

function reset() {
  effect?.reset();
  activePreset.value = null;
  themeOverrides.value = [];
  rebindTheme();
  syncValues();
  requestRender();
  writeUrl();
}

/** Moves the compare divider by keyboard: arrows (Shift for 10%), Home and End. */
function dividerKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 10 : 1;
  const next =
    event.key === 'ArrowLeft' || event.key === 'ArrowDown'
      ? divider.value - step
      : event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? divider.value + step
        : event.key === 'Home'
          ? 5
          : event.key === 'End'
            ? 95
            : null;
  if (next === null) return;
  event.preventDefault();
  divider.value = Math.max(5, Math.min(95, next));
  requestRender();
}

/** Drags the compare divider with a mouse, pen or finger. */
function dividerDrag(event: PointerEvent) {
  const handle = event.currentTarget as HTMLElement;
  try {
    handle.setPointerCapture(event.pointerId);
  } catch {
    /* Synthetic or already released pointers can't be captured. */
  }
  const move = (e: PointerEvent) => {
    const rect = stage.value!.getBoundingClientRect();
    divider.value = Math.max(
      5,
      Math.min(95, ((e.clientX - rect.left) / rect.width) * 100),
    );
    requestRender();
  };
  move(event);
  const up = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}

function togglePlay() {
  playing.value = !playing.value;
  requestRender();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(code.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* Clipboard access can be denied; the code stays selectable. */
  }
}

onMounted(async () => {
  const host = stage.value!;
  const load = effectLoaders[props.effect];
  if (!load) {
    status.value = 'error';
    errorMessage.value = `Unknown effect "${props.effect}".`;
    return;
  }
  // Without WebGL2 the demo shows its poster, without loading three.js.
  if (!document.createElement('canvas').getContext('webgl2')) {
    status.value = 'unsupported';
    return;
  }
  const [three, core, scenes, factory, runtime, holo] = await Promise.all([
    import('three'),
    import('@mk7s/xtree/core'),
    import('@xtree/scenes'),
    load(),
    import('@mk7s/holocss/runtime'),
    import('@mk7s/xtree/holocss'),
  ]);
  if (!root.value) return;

  let renderer: InstanceType<typeof three.WebGLRenderer>;
  try {
    renderer = new three.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
  } catch {
    status.value = 'unsupported';
    return;
  }
  renderer.toneMapping = three.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', `${factory.definition.meta.title} demo`);
  canvas.setAttribute('role', 'img');
  host.prepend(canvas);

  const studio = scenes.createStudio(16 / 9);
  const composer = new core.EffectComposer(renderer, { multisampling: 4 });
  // The demo's own Pause button and motion policy decide when time moves.
  composer.play();
  composer.setScene(studio.scene, studio.camera);
  findObject = (name) => studio.scene.getObjectByName(name);
  effect = factory();
  definition.value = factory.definition;
  const materialEffect =
    factory.definition.kind === 'material'
      ? (effect as unknown as MaterialEffect)
      : null;
  if (materialEffect) {
    for (const name of selectionNames.value) {
      const mesh = findObject(name) as { material?: unknown } | undefined;
      if (mesh?.material)
        core.patchMaterial(mesh.material as never, materialEffect);
    }
  } else if (factory.definition.kind !== 'transition') {
    composer.add(effect);
    setMask(factory.definition.meta.demo?.selection ? 'selection' : 'none');
  }
  syncValues();

  // Transitions: the studio from two camera angles, rendered (tone-mapped, linear) into textures.
  let player: ReturnType<typeof core.createTransition> | null = null;
  const views: InstanceType<typeof three.WebGLRenderTarget>[] = [];
  const renderViews = () => {
    const second = studio.camera.clone();
    second.position.set(4.5, 2.6, 5.2);
    second.lookAt(0, 0.9, 0);
    const output = renderer.outputColorSpace;
    renderer.outputColorSpace = three.LinearSRGBColorSpace;
    for (const [i, camera] of [studio.camera, second].entries()) {
      const size = renderer.getDrawingBufferSize(new three.Vector2());
      views[i] ??= new three.WebGLRenderTarget(1, 1, {
        type: three.HalfFloatType,
      });
      views[i]!.setSize(size.x, size.y);
      composer.setScene(studio.scene, camera);
      composer.render(0, views[i]!);
    }
    renderer.outputColorSpace = output;
    composer.setScene(studio.scene, studio.camera);
  };
  if (factory.definition.kind === 'transition') {
    renderViews();
    player = core.createTransition(renderer, effect as never, {
      from: views[0]!.texture,
      to: views[1]!.texture,
    });
  }

  // Theme-aware colors and the transition accent follow the site's HoloCSS
  // theme (X15.2), except colors the visitor or a preset chose.
  let unbindTheme = () => {};
  rebindTheme = () => {
    unbindTheme();
    unbindTheme = holo.bindTheme(
      player ? [effect!, player] : [effect!],
      root.value!,
      {
        roles: Object.fromEntries(
          themeOverrides.value.map((name) => [name, null]),
        ),
        onChange: () => {
          syncValues();
          requestRender();
        },
      },
    );
  };
  rebindTheme();

  const resize = () => {
    const width = host.clientWidth;
    const height = Math.round((width * 9) / 16);
    renderer.setSize(width, height);
    studio.resize(width / height);
    if (player) renderViews();
    requestRender();
  };

  let raf = 0;
  let visible = true;
  let last = performance.now();
  let sceneTime = 0;
  let transitionTime = Math.acos(0) / 1.2;
  const frame = (now: number) => {
    raf = 0;
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    const animating = playing.value && motion.value;
    if (animating) {
      sceneTime += delta;
      studio.update(sceneTime);
    }
    if (animating) materialEffect?.tick(delta);
    if (player) {
      if (animating) {
        transitionTime += delta;
        transitionProgress.value = 0.5 - 0.5 * Math.cos(transitionTime * 1.2);
      }
      player.progress = transitionProgress.value;
      player.render();
      if (animating && visible) raf = requestAnimationFrame(frame);
      return;
    }
    composer.render(animating ? delta : 0);
    passes.value = composer.passes.length;
    if (compare.value && !materialEffect) {
      // "Before": the plain scene over the left part of the canvas.
      const cut = Math.round((canvas.clientWidth * divider.value) / 100);
      renderer.setScissorTest(true);
      renderer.setScissor(0, 0, cut, canvas.clientHeight);
      renderer.setRenderTarget(null);
      renderer.render(studio.scene, studio.camera);
      renderer.setScissorTest(false);
    }
    if (animating && visible) raf = requestAnimationFrame(frame);
  };
  requestRender = () => {
    if (!raf && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  // The HoloCSS motion policy: reduced motion, data-hcss-motion="none" and high contrast.
  const element = root.value;
  motion.value = runtime.motionAllowed(element);
  playing.value = motion.value;
  composer.motion = motion.value;
  materialEffect?.setMotion(motion.value);
  const stopWatching = runtime.watchMotion(element, (allowed: boolean) => {
    motion.value = allowed;
    composer.motion = allowed;
    materialEffect?.setMotion(allowed);
    if (!allowed) playing.value = false;
    requestRender();
  });

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    if (visible) requestRender();
  });
  visibility.observe(host);

  // `tilt` and `center` follow the pointer, mapped across their range.
  const pointerName = pointerParams.find(
    (name) => factory.definition.params[name]?.kind === 'vec2',
  );
  const onPointer = (event: PointerEvent) => {
    if (!pointerName || !followPointer.value || event.pointerType === 'touch')
      return;
    const param = factory.definition.params[pointerName];
    if (param?.kind !== 'vec2') return;
    const rect = canvas.getBoundingClientRect();
    const u = (event.clientX - rect.left) / rect.width;
    const v = 1 - (event.clientY - rect.top) / rect.height;
    const map = (t: number) =>
      param.min + Math.max(0, Math.min(1, t)) * (param.max - param.min);
    setParam(pointerName, [map(u), map(v)]);
  };
  canvas.addEventListener('pointermove', onPointer);

  // The stats overlay: FPS, GPU time where timer queries exist, draws and programs.
  let overlay: ReturnType<typeof core.createDebugOverlay> | null = null;
  setStats = (on: boolean) => {
    overlay?.dispose();
    overlay = on ? core.createDebugOverlay(composer, host) : null;
  };

  const live = window as unknown as { __xtreeLiveDemos?: number };
  live.__xtreeLiveDemos = (live.__xtreeLiveDemos ?? 0) + 1;
  status.value = 'ready';
  readUrl();
  urlReady = true;
  writeUrl();
  resize();

  teardown = () => {
    cancelAnimationFrame(raf);
    requestRender = () => {};
    observer.disconnect();
    visibility.disconnect();
    stopWatching();
    unbindTheme();
    overlay?.dispose();
    canvas.removeEventListener('pointermove', onPointer);
    composer.dispose();
    materialEffect?.dispose();
    player?.dispose();
    for (const view of views) view.dispose();
    if (player) effect?.dispose();
    studio.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    live.__xtreeLiveDemos = (live.__xtreeLiveDemos ?? 1) - 1;
    effect = null;
  };
});

watch(stats, (on) => setStats(on));
onBeforeUnmount(() => teardown?.());
</script>

<template>
  <section
    ref="root"
    class="xt-demo hcss-components"
    :aria-label="`${definition?.meta.title ?? 'Effect'} demo`"
  >
    <div ref="stage" class="xt-demo-stage">
      <p v-if="status === 'loading'" class="xt-demo-status">
        Loading the demo…
      </p>
      <template v-else-if="status === 'unsupported'">
        <img
          class="xt-demo-poster"
          :src="withBase(`/thumbnails/${props.effect}.png`)"
          :alt="`A still of the ${props.effect} effect`"
        />
        <p class="xt-demo-status xt-demo-notice" role="status">
          This live demo needs WebGL2, which this browser or device does not
          provide. The image shows the effect with its default settings.
        </p>
      </template>
      <p v-else-if="status === 'error'" class="xt-demo-status">
        {{ errorMessage }}
      </p>
      <div
        v-if="compare && status === 'ready'"
        class="xt-demo-divider"
        role="slider"
        tabindex="0"
        aria-label="Before and after divider"
        aria-valuemin="5"
        aria-valuemax="95"
        :aria-valuenow="Math.round(divider)"
        :aria-valuetext="`${Math.round(divider)}% before`"
        :style="{ left: `${divider}%` }"
        @pointerdown.prevent="dividerDrag"
        @keydown="dividerKey"
      >
        <span aria-hidden="true">Before</span
        ><span aria-hidden="true">After</span>
      </div>
    </div>

    <div v-if="definition" class="xt-demo-toolbar">
      <button
        class="hcss-button"
        data-variant="secondary"
        data-size="sm"
        type="button"
        :aria-pressed="!playing"
        @click="togglePlay"
      >
        {{ playing ? 'Pause' : 'Play' }}
      </button>
      <label v-if="isPost" class="hcss-choice">
        <input
          v-model="compare"
          class="hcss-switch"
          type="checkbox"
          role="switch"
          @change="requestRender()"
        />
        Compare
      </label>
      <label v-if="!isTransition" class="hcss-choice">
        <input
          v-model="stats"
          class="hcss-switch"
          type="checkbox"
          role="switch"
        />
        Stats
      </label>
      <span v-if="isTransition" class="xt-demo-meta"
        >Between two camera views</span
      >
      <span v-else-if="isMaterial" class="xt-demo-meta"
        >Patched into the {{ selectionNames.join(' and ') }}</span
      >
      <span v-else class="xt-demo-meta"
        >{{ passes }} {{ passes === 1 ? 'pass' : 'passes' }}</span
      >
      <span v-if="!motion" class="xt-demo-meta">Motion is off</span>
    </div>

    <div
      v-if="presetNames.length"
      class="xt-demo-presets"
      role="group"
      aria-label="Presets"
    >
      <span class="xt-demo-label">Presets</span>
      <button
        v-for="preset in presetNames"
        :key="preset"
        class="hcss-button"
        data-variant="outline"
        data-size="sm"
        type="button"
        @click="applyPreset(preset)"
      >
        {{ labelFor(preset) }}
      </button>
      <button
        class="hcss-button"
        data-variant="ghost"
        data-size="sm"
        type="button"
        @click="reset"
      >
        Reset
      </button>
    </div>

    <form v-if="definition" class="xt-demo-controls" @submit.prevent>
      <div v-if="isTransition" class="hcss-field">
        <label class="hcss-label" :for="fieldId('progress')">Progress</label>
        <input
          :id="fieldId('progress')"
          v-model.number="transitionProgress"
          class="hcss-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          @input="
            playing = false;
            requestRender();
          "
        />
        <p class="hcss-description">
          Drag to scrub; Play loops between the two views.
        </p>
      </div>
      <div v-if="isPost" class="hcss-field xt-demo-mask">
        <fieldset class="hcss-segmented">
          <legend>Mask</legend>
          <label v-for="(label, choice) in maskOptions" :key="choice">
            <input
              type="radio"
              :name="fieldId('mask')"
              :value="choice"
              :checked="maskChoice === choice"
              @change="setMask(choice)"
            />
            {{ label }}
          </label>
        </fieldset>
        <p class="hcss-description">
          Limit the effect to the {{ selectionNames.join(' and ') }} (through
          other objects with x-ray), or to everything beyond 9 units.
          <a :href="withBase('/guide/masks')">About masks</a>
        </p>
      </div>
      <template v-for="[name, param] in paramEntries" :key="name">
        <div
          v-if="param.kind === 'float' || param.kind === 'int'"
          class="hcss-field"
        >
          <label class="hcss-label" :for="fieldId(name)">{{
            labelFor(name, param)
          }}</label>
          <div class="hcss-slider-stage">
            <span
              class="hcss-slider-track"
              aria-hidden="true"
              :style="fill(param, values[name] as number)"
            ></span>
            <input
              :id="fieldId(name)"
              class="hcss-slider"
              type="range"
              :min="param.min"
              :max="param.max"
              :step="stepOf(param)"
              :value="values[name] as number"
              :aria-describedby="fieldId(name, '-help')"
              @input="
                setParam(
                  name,
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
          </div>
          <output class="hcss-slider-output" :for="fieldId(name)">{{
            format(param, values[name] as number)
          }}</output>
          <p :id="fieldId(name, '-help')" class="hcss-description">
            {{ param.description }}
          </p>
        </div>

        <div v-else-if="param.kind === 'bool'" class="hcss-field">
          <label class="hcss-choice">
            <input
              class="hcss-switch"
              type="checkbox"
              role="switch"
              :checked="values[name] as boolean"
              @change="
                setParam(name, ($event.target as HTMLInputElement).checked)
              "
            />
            {{ labelFor(name, param) }}
          </label>
          <p class="hcss-description">{{ param.description }}</p>
        </div>

        <div v-else-if="param.kind === 'select'" class="hcss-field">
          <fieldset v-if="param.options.length <= 4" class="hcss-segmented">
            <legend>{{ labelFor(name, param) }}</legend>
            <label v-for="option in param.options" :key="option">
              <input
                type="radio"
                :name="fieldId(name)"
                :value="option"
                :checked="values[name] === option"
                @change="setParam(name, option)"
              />
              {{ optionLabel(param, option) }}
            </label>
          </fieldset>
          <template v-else>
            <label class="hcss-label" :for="fieldId(name)">{{
              labelFor(name, param)
            }}</label>
            <select
              :id="fieldId(name)"
              class="hcss-select"
              :value="values[name] as string"
              @change="
                setParam(name, ($event.target as HTMLSelectElement).value)
              "
            >
              <option
                v-for="option in param.options"
                :key="option"
                :value="option"
              >
                {{ optionLabel(param, option) }}
              </option>
            </select>
          </template>
          <p class="hcss-description">{{ param.description }}</p>
        </div>

        <div v-else-if="param.kind === 'texture'" class="hcss-field">
          <label class="hcss-label" :for="fieldId(name)">{{
            labelFor(name, param)
          }}</label>
          <select
            :id="fieldId(name)"
            class="hcss-select"
            :value="values[name] ?? ''"
            @change="
              setParam(name, ($event.target as HTMLSelectElement).value || null)
            "
          >
            <option value="">None</option>
            <option
              v-for="sample in Object.keys(param.samples ?? {})"
              :key="sample"
              :value="sample"
            >
              {{ labelFor(sample) }}
            </option>
          </select>
          <p class="hcss-description">{{ param.description }}</p>
        </div>

        <fieldset
          v-else-if="param.kind === 'gradient'"
          class="hcss-field xt-demo-vector"
        >
          <legend class="hcss-label">{{ labelFor(name, param) }}</legend>
          <label
            v-for="(stop, index) in values[name] as [number, string][]"
            :key="index"
            class="xt-demo-stop"
          >
            <span>{{ Math.round(stop[0] * 100) }}%</span>
            <input
              type="color"
              class="hcss-color"
              :value="stop[1]"
              :aria-label="`${labelFor(name, param)} stop at ${Math.round(stop[0] * 100)}%`"
              @input="
                setParam(
                  name,
                  (values[name] as [number, string][]).map((s, i) =>
                    i === index
                      ? [s[0], ($event.target as HTMLInputElement).value]
                      : s,
                  ),
                )
              "
            />
          </label>
          <p class="hcss-description">{{ param.description }}</p>
        </fieldset>

        <fieldset
          v-else-if="param.kind === 'curve'"
          class="hcss-field xt-demo-vector"
        >
          <legend class="hcss-label">{{ labelFor(name, param) }}</legend>
          <label
            v-for="(point, index) in values[name] as [number, number][]"
            :key="index"
            class="xt-demo-stop"
          >
            <span>x {{ point[0] }}</span>
            <input
              type="range"
              class="hcss-slider"
              :min="param.min ?? 0"
              :max="param.max ?? 1"
              step="0.01"
              :value="point[1]"
              :aria-label="`${labelFor(name, param)} at x ${point[0]}`"
              @input="
                setParam(
                  name,
                  (values[name] as [number, number][]).map((p, i) =>
                    i === index
                      ? [
                          p[0],
                          Number(($event.target as HTMLInputElement).value),
                        ]
                      : p,
                  ),
                )
              "
            />
          </label>
          <p class="hcss-description">{{ param.description }}</p>
        </fieldset>

        <div v-else-if="param.kind === 'color'" class="hcss-field">
          <label class="hcss-label" :for="fieldId(name)">{{
            labelFor(name, param)
          }}</label>
          <input
            :id="fieldId(name)"
            class="xt-demo-color"
            type="color"
            :value="values[name] as string"
            @input="setParam(name, ($event.target as HTMLInputElement).value)"
          />
          <p class="hcss-description">{{ param.description }}</p>
        </div>

        <fieldset
          v-else-if="param.kind === 'vec2' || param.kind === 'vec3'"
          class="hcss-fieldset xt-demo-vector"
        >
          <legend>{{ labelFor(name, param) }}</legend>
          <div
            v-for="(axis, index) in ['x', 'y', 'z'].slice(
              0,
              param.kind === 'vec2' ? 2 : 3,
            )"
            :key="axis"
            class="hcss-field"
          >
            <label class="hcss-label" :for="fieldId(name, `-${axis}`)">{{
              axis
            }}</label>
            <div class="hcss-slider-stage">
              <span
                class="hcss-slider-track"
                aria-hidden="true"
                :style="fill(param, (values[name] as number[])[index]!)"
              ></span>
              <input
                :id="fieldId(name, `-${axis}`)"
                class="hcss-slider"
                type="range"
                :min="param.min"
                :max="param.max"
                :step="stepOf(param)"
                :value="(values[name] as number[])[index]"
                @input="
                  setComponent(
                    name,
                    index,
                    Number(($event.target as HTMLInputElement).value),
                  )
                "
              />
            </div>
            <output class="hcss-slider-output">{{
              format(param, (values[name] as number[])[index]!)
            }}</output>
          </div>
          <label v-if="pointerParams.includes(name)" class="hcss-choice">
            <input
              v-model="followPointer"
              class="hcss-switch"
              type="checkbox"
              role="switch"
            />
            Follow the pointer over the demo
          </label>
          <p class="hcss-description">{{ param.description }}</p>
        </fieldset>
      </template>
    </form>

    <div v-if="definition" class="hcss-code-block xt-demo-code">
      <div class="xt-demo-code-header">
        <strong>Code for these settings</strong>
        <div class="hcss-segmented xt-demo-code-tabs" role="tablist">
          <button
            v-for="(label, tab) in {
              three: 'three.js',
              holocss: 'With HoloCSS',
            }"
            :key="tab"
            type="button"
            role="tab"
            :aria-selected="codeTab === tab"
            :class="{ 'xt-demo-tab-active': codeTab === tab }"
            @click="codeTab = tab"
          >
            {{ label }}
          </button>
        </div>
        <button
          class="hcss-button"
          data-variant="ghost"
          data-size="sm"
          type="button"
          @click="copy"
        >
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
      <pre><code>{{ code }}</code></pre>
    </div>
  </section>
</template>
