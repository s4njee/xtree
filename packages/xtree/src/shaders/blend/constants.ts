/** Values of the `XT_BLEND_*` constants, for passing a runtime mode as an `int` uniform. */
export const blendModes = {
  normal: 0,
  darken: 1,
  multiply: 2,
  colorBurn: 3,
  linearBurn: 4,
  darkerColor: 5,
  lighten: 6,
  screen: 7,
  colorDodge: 8,
  add: 9,
  lighterColor: 10,
  overlay: 11,
  softLight: 12,
  hardLight: 13,
  vividLight: 14,
  linearLight: 15,
  pinLight: 16,
  hardMix: 17,
  difference: 18,
  exclusion: 19,
  subtract: 20,
  divide: 21,
  hue: 22,
  saturation: 23,
  color: 24,
  luminosity: 25,
} as const;

/** The name of a blend mode. */
export type BlendMode = keyof typeof blendModes;
