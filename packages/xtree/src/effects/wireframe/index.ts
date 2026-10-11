import type { BufferAttribute, BufferGeometry } from 'three';
import {
  bool,
  color,
  defineMaterialEffect,
  float,
} from '../../effect/index.js';
import fragment from './fragment.glsl';

/** Glowing lines along every triangle edge. */
export const wireframe = defineMaterialEffect({
  name: 'wireframe',
  meta: {
    title: 'Wireframe glow',
    family: 'material',
    story: 'X12.6',
    description:
      'Draws glowing lines along every triangle edge at a constant width on screen, over a faint fill or nothing at all. The geometry needs barycentric coordinates: prepare it once with `withBarycentric(geometry)`.',
    related: ['hologram', 'x-ray', 'hud-grid'],
    // The knot's triangles are only a few pixels across, so the box shows the lines best.
    demo: { selection: ['box'] },
  },
  barycentric: true,
  params: {
    lineColor: color({
      theme: 'accent',
      default: '#5ad8ff',
      description: 'Line color.',
    }),
    glow: float({
      default: 2,
      min: 0,
      max: 10,
      step: 0.05,
      description: 'Line brightness, in linear units (above 1 blooms).',
    }),
    thickness: float({
      default: 1.2,
      min: 0.25,
      max: 6,
      step: 0.05,
      unit: 'px',
      description: 'Line width on screen.',
    }),
    fillColor: color({
      default: '#060814',
      description: 'Color the faces are tinted toward.',
    }),
    fillOpacity: float({
      default: 0.85,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'How far the faces are tinted toward the fill color.',
    }),
    hideFill: bool({
      default: false,
      description:
        'Draw the lines only (pair with additive blending in a scene of your own).',
    }),
    fadeGrazing: float({
      default: 0.6,
      min: 0,
      max: 1,
      step: 0.01,
      description: 'Fade lines on faces seen edge-on.',
    }),
  },
  presets: {
    tron: { lineColor: '#00e5ff', glow: 3, fillOpacity: 0.95 },
    blueprint: { lineColor: '#ffffff', glow: 1, fillColor: '#103a7a' },
    overlay: { fillOpacity: 0, glow: 1.2, thickness: 1 },
    neon: { lineColor: '#ff4fd8', glow: 4, thickness: 2 },
  },
  fragment,
});

/**
 * Returns geometry ready for `wireframe`: non-indexed, with a barycentric
 * attribute (`xtBarycentric`) giving each triangle's corners (1,0,0),
 * (0,1,0) and (0,0,1). Indexed geometry is converted with
 * `toNonIndexed()`, which returns a new geometry; dispose the old one if
 * you no longer need it.
 */
export function withBarycentric<G extends BufferGeometry>(geometry: G): G {
  const flat = (geometry.index ? geometry.toNonIndexed() : geometry) as G;
  const position = flat.getAttribute('position') as BufferAttribute;
  const data = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) data[i * 3 + (i % 3)] = 1;
  // The position attribute's own class, so this module doesn't import three.
  const Attribute = position.constructor as new (
    array: Float32Array,
    itemSize: number,
  ) => BufferAttribute;
  flat.setAttribute('xtBarycentric', new Attribute(data, 3));
  return flat;
}
