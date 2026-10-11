<script setup lang="ts">
import type {
  Effect,
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
} from 'vue';
import { effectLoaders } from './effect-registry';

const props = defineProps<{ effect: string }>();

type Definition = EffectFactory<ParamSchema>['definition'];
type Value = number | boolean | string | null | readonly number[];

const root = ref<HTMLElement>();
const stage = ref<HTMLElement>();
const status = ref<'loading' | 'ready' | 'unsupported' | 'error'>('loading');
const errorMessage = ref('');
const definition = shallowRef<Definition | null>(null);
const values = reactive<Record<string, Value>>({});
const playing = ref(true);
const motion = ref(true);
const compare = ref(false);
const divider = ref(50);
const followPointer = ref(true);
const pointerParams = ['tilt', 'center'];
const passes = ref(0);
const copied = ref(false);

let effect: Effect | null = null;
let requestRender = () => {};
let teardown: (() => void) | null = null;

const paramEntries = computed(
  () => Object.entries(definition.value?.params ?? {}) as [string, Param][],
);
const presetNames = computed(() =>
  Object.keys(definition.value?.presets ?? {}),
);
const factoryName = computed(() =>
  props.effect.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
);
const fieldId = (name: string, suffix = '') =>
  `xt-${props.effect}-${name}${suffix}`;

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
}

function literal(value: Value): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return String(Number(value.toFixed(4)));
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value))
    return `[${value.map((v) => Number((v as number).toFixed(3))).join(', ')}]`;
  return String(value);
}

const code = computed(() => {
  const def = definition.value;
  if (!def) return '';
  const changed = paramEntries.value
    .filter(([name, param]) => !sameValue(values[name], param.default))
    .map(([name]) => `${name}: ${literal(values[name]!)}`);
  const options = changed.length ? `{ ${changed.join(', ')} }` : '';
  return [
    "import { EffectComposer } from '@mk7s/xtree/core';",
    `import { ${factoryName.value} } from '@mk7s/xtree/effects/${props.effect}';`,
    '',
    'const composer = new EffectComposer(renderer);',
    'composer.setScene(scene, camera);',
    `composer.add(${factoryName.value}(${options}));`,
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
  requestRender();
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
  effect?.applyPreset(name);
  syncValues();
  requestRender();
}

function reset() {
  effect?.reset();
  syncValues();
  requestRender();
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
  const [three, core, scenes, factory, runtime] = await Promise.all([
    import('three'),
    import('@mk7s/xtree/core'),
    import('@xtree/scenes'),
    load(),
    import('@mk7s/holocss/runtime'),
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
  composer.setScene(studio.scene, studio.camera);
  effect = factory();
  composer.add(effect);
  definition.value = factory.definition;
  syncValues();

  const resize = () => {
    const width = host.clientWidth;
    const height = Math.round((width * 9) / 16);
    renderer.setSize(width, height);
    studio.resize(width / height);
    requestRender();
  };

  let raf = 0;
  let visible = true;
  let last = performance.now();
  let sceneTime = 0;
  const frame = (now: number) => {
    raf = 0;
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    const animating = playing.value && motion.value;
    if (animating) {
      sceneTime += delta;
      studio.update(sceneTime);
    }
    composer.render(animating ? delta : 0);
    passes.value = composer.passes.length;
    if (compare.value) {
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
  const stopWatching = runtime.watchMotion(element, (allowed: boolean) => {
    motion.value = allowed;
    composer.motion = allowed;
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

  const live = window as unknown as { __xtreeLiveDemos?: number };
  live.__xtreeLiveDemos = (live.__xtreeLiveDemos ?? 0) + 1;
  status.value = 'ready';
  resize();

  teardown = () => {
    cancelAnimationFrame(raf);
    requestRender = () => {};
    observer.disconnect();
    visibility.disconnect();
    stopWatching();
    canvas.removeEventListener('pointermove', onPointer);
    composer.dispose();
    studio.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    live.__xtreeLiveDemos = (live.__xtreeLiveDemos ?? 1) - 1;
    effect = null;
  };
});

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
      <p v-else-if="status === 'unsupported'" class="xt-demo-status">
        This demo needs WebGL2, which this browser or device does not provide.
      </p>
      <p v-else-if="status === 'error'" class="xt-demo-status">
        {{ errorMessage }}
      </p>
      <div
        v-if="compare && status === 'ready'"
        class="xt-demo-divider"
        :style="{ left: `${divider}%` }"
        aria-hidden="true"
      >
        <span>Before</span><span>After</span>
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
      <label class="hcss-choice">
        <input
          v-model="compare"
          class="hcss-switch"
          type="checkbox"
          role="switch"
          @change="requestRender()"
        />
        Compare
      </label>
      <input
        v-if="compare"
        v-model.number="divider"
        class="hcss-slider xt-demo-divider-input"
        type="range"
        min="5"
        max="95"
        aria-label="Divider position"
        @input="requestRender()"
      />
      <span class="xt-demo-meta"
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
