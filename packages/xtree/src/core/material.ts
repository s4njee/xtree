import { AdditiveBlending, DoubleSide, NormalBlending } from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';
import type { MaterialEffect } from '../effect/material.js';
import { compileMaterial, materialSignature } from './material-compile.js';

/** Built-in materials that patches can hook into. */
const supported = new Set([
  'MeshBasicMaterial',
  'MeshLambertMaterial',
  'MeshPhongMaterial',
  'MeshStandardMaterial',
  'MeshPhysicalMaterial',
  'MeshToonMaterial',
  'MeshMatcapMaterial',
]);

interface Original {
  readonly onBeforeCompile: Material['onBeforeCompile'];
  readonly customProgramCacheKey: Material['customProgramCacheKey'];
  readonly transparent: boolean;
  readonly depthWrite: boolean;
  readonly blending: Material['blending'];
  readonly side: Material['side'];
}

interface PatchState {
  effects: MaterialEffect[];
  /** Whether the hooks are on the material (false after unpatching everything). */
  installed: boolean;
  /** The current effects' uniform objects by GLSL name. */
  bindings: Readonly<Record<string, { value: unknown }>>;
  /** One stable object per GLSL name; each reads through to `bindings`. */
  readonly slots: Map<string, { value: unknown }>;
  original: Original;
  readonly unsubscribe: Map<MaterialEffect, () => void>;
}

const states = new WeakMap<Material, PatchState>();

/**
 * three.js binds a material's uniform objects only when it compiles a program
 * for it, and reuses that program (and those objects) whenever the cache key
 * matches again. Slots stay the same objects for the material's lifetime and
 * read whichever effect currently sits at their position, so a cached program
 * always sees the current effects.
 */
function slot(state: PatchState, name: string): { value: unknown } {
  let object = state.slots.get(name);
  if (!object) {
    object = {
      get value() {
        return state.bindings[name]?.value ?? null;
      },
      set value(value: unknown) {
        const binding = state.bindings[name];
        if (binding) binding.value = value;
      },
    };
    state.slots.set(name, object);
  }
  return object;
}

function rebind(state: PatchState): void {
  state.bindings = compileMaterial(state.effects, { lit: true }).uniforms;
}

/** Splices `source` after the line containing `anchor`, or before it with `before`. */
function splice(
  shader: string,
  anchor: string,
  source: string,
  where: 'before' | 'after',
  material: Material,
): string {
  const index = shader.indexOf(anchor);
  if (index === -1)
    throw new Error(
      `patchMaterial: ${material.type} has no ${anchor}; it can't be patched`,
    );
  const at = where === 'before' ? index : index + anchor.length;
  return `${shader.slice(0, at)}\n${source}\n${shader.slice(at)}`;
}

function inject(
  material: Material,
  state: PatchState,
  shader: WebGLProgramParametersWithUniforms,
): void {
  const lit = shader.fragmentShader.includes(
    '#include <normal_fragment_begin>',
  );
  const code = compileMaterial(state.effects, { lit });
  for (const name of Object.keys(code.uniforms))
    shader.uniforms[name] = slot(state, name) as never;
  let vertex = splice(
    shader.vertexShader,
    '#include <common>',
    code.vertexPars,
    'after',
    material,
  );
  vertex = splice(
    vertex,
    '#include <project_vertex>',
    code.vertexBeforeProject,
    'before',
    material,
  );
  vertex = splice(
    vertex,
    '#include <project_vertex>',
    code.vertexAfterProject,
    'after',
    material,
  );
  let fragment = splice(
    shader.fragmentShader,
    '#include <common>',
    code.fragmentPars,
    'after',
    material,
  );
  fragment = splice(
    fragment,
    '#include <opaque_fragment>',
    code.fragmentMain,
    'after',
    material,
  );
  shader.vertexShader = vertex;
  shader.fragmentShader = fragment;
}

/** Applies the last patched effect's settings, or the material's own. */
function applySettings(material: Material, state: PatchState): void {
  const { original } = state;
  const settings = [...state.effects]
    .reverse()
    .find((e) => e.materialDefinition.settings)?.materialDefinition.settings;
  material.transparent = settings?.transparent ?? original.transparent;
  material.depthWrite = settings?.depthWrite ?? original.depthWrite;
  material.blending =
    settings?.blending === 'additive'
      ? AdditiveBlending
      : settings?.blending === 'normal'
        ? NormalBlending
        : original.blending;
  material.side = settings?.doubleSided ? DoubleSide : original.side;
}

function snapshot(material: Material): Original {
  return {
    onBeforeCompile: material.onBeforeCompile,
    customProgramCacheKey: material.customProgramCacheKey,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    blending: material.blending,
    side: material.side,
  };
}

function install(material: Material, state: PatchState): void {
  const original = snapshot(material);
  state.original = original;
  state.installed = true;
  material.onBeforeCompile = (shader, renderer) => {
    original.onBeforeCompile.call(material, shader, renderer);
    inject(material, state, shader);
  };
  material.customProgramCacheKey = () =>
    `${original.customProgramCacheKey.call(material)}|${materialSignature(state.effects)}`;
}

/**
 * Adds material effects to a three.js material, in order after any already
 * there. Their GLSL is spliced into the material's own shader, so lighting,
 * shadows received, fog and tone mapping keep working. Parameter changes
 * update uniforms; structural changes recompile the materials using the
 * effect. An effect may be patched into many materials.
 *
 * ```ts
 * const glow = fresnelGlow({ color: '#5ad8ff' });
 * patchMaterial(mesh.material, glow);
 * ```
 */
export function patchMaterial(
  material: Material,
  ...effects: MaterialEffect[]
): Material {
  if (!supported.has(material.type))
    throw new TypeError(
      `patchMaterial: ${material.type} is not supported; use one of ${[...supported].join(', ')}`,
    );
  // The state, and its uniform slots, live as long as the material: three.js
  // may reuse a program it compiled for an earlier patch of this material.
  let state = states.get(material);
  if (!state) {
    state = {
      effects: [],
      installed: false,
      bindings: {},
      slots: new Map(),
      original: snapshot(material),
      unsubscribe: new Map(),
    };
    states.set(material, state);
  }
  if (!state.installed) install(material, state);
  for (const effect of effects) {
    if (state.effects.includes(effect))
      throw new TypeError(
        `patchMaterial: ${effect.name} is already patched into this material`,
      );
    state.effects.push(effect);
    state.unsubscribe.set(
      effect,
      effect.onStructureChange(() => {
        material.needsUpdate = true;
      }),
    );
  }
  rebind(state);
  applySettings(material, state);
  material.needsUpdate = true;
  return material;
}

/**
 * Removes material effects from a material (all of them when none are
 * given), restoring its own shader and settings once none are left. The
 * effects are not disposed.
 */
export function unpatchMaterial(
  material: Material,
  ...effects: MaterialEffect[]
): Material {
  const state = states.get(material);
  if (!state) return material;
  const removing = effects.length ? effects : [...state.effects];
  for (const effect of removing) {
    state.unsubscribe.get(effect)?.();
    state.unsubscribe.delete(effect);
  }
  state.effects = state.effects.filter((e) => !removing.includes(e));
  rebind(state);
  if (state.effects.length === 0 && state.installed) {
    material.onBeforeCompile = state.original.onBeforeCompile;
    material.customProgramCacheKey = state.original.customProgramCacheKey;
    state.installed = false;
  }
  applySettings(material, state);
  material.needsUpdate = true;
  return material;
}

/** The material effects patched into a material, in order. */
export function materialEffects(material: Material): readonly MaterialEffect[] {
  return states.get(material)?.effects ?? [];
}
