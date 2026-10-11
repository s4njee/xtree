/**
 * Photoshop-style blend modes. Separable and non-separable formulas follow
 * W3C Compositing and Blending Level 1 where it defines them. `base` is the
 * backdrop and `blend` is the source. Modes defined only for [0, 1] (the
 * dodges, burns, light modes, hard mix and divide) clamp their result to
 * [0, 1]. Normal, multiply, add, lighten, darken, difference and the
 * non-separable modes pass HDR values through.
 */

#define XT_BLEND_NORMAL 0
#define XT_BLEND_DARKEN 1
#define XT_BLEND_MULTIPLY 2
#define XT_BLEND_COLOR_BURN 3
#define XT_BLEND_LINEAR_BURN 4
#define XT_BLEND_DARKER_COLOR 5
#define XT_BLEND_LIGHTEN 6
#define XT_BLEND_SCREEN 7
#define XT_BLEND_COLOR_DODGE 8
#define XT_BLEND_ADD 9
#define XT_BLEND_LIGHTER_COLOR 10
#define XT_BLEND_OVERLAY 11
#define XT_BLEND_SOFT_LIGHT 12
#define XT_BLEND_HARD_LIGHT 13
#define XT_BLEND_VIVID_LIGHT 14
#define XT_BLEND_LINEAR_LIGHT 15
#define XT_BLEND_PIN_LIGHT 16
#define XT_BLEND_HARD_MIX 17
#define XT_BLEND_DIFFERENCE 18
#define XT_BLEND_EXCLUSION 19
#define XT_BLEND_SUBTRACT 20
#define XT_BLEND_DIVIDE 21
#define XT_BLEND_HUE 22
#define XT_BLEND_SATURATION 23
#define XT_BLEND_COLOR 24
#define XT_BLEND_LUMINOSITY 25

/// Darken: the smaller of each channel.
vec3 xt_blendDarken(vec3 base, vec3 blend) {
  return min(base, blend);
}

/// Multiply.
vec3 xt_blendMultiply(vec3 base, vec3 blend) {
  return base * blend;
}

/// Color burn (W3C).
vec3 xt_blendColorBurn(vec3 base, vec3 blend) {
  vec3 burn = 1.0 - min(vec3(1.0), (1.0 - base) / max(blend, 1e-6));
  vec3 result = mix(burn, vec3(0.0), lessThanEqual(blend, vec3(0.0)));
  return clamp(mix(result, vec3(1.0), greaterThanEqual(base, vec3(1.0))), 0.0, 1.0);
}

/// Linear burn: base + blend - 1, clamped.
vec3 xt_blendLinearBurn(vec3 base, vec3 blend) {
  return clamp(base + blend - 1.0, 0.0, 1.0);
}

/// Lighten: the larger of each channel.
vec3 xt_blendLighten(vec3 base, vec3 blend) {
  return max(base, blend);
}

/// Screen.
vec3 xt_blendScreen(vec3 base, vec3 blend) {
  return base + blend - base * blend;
}

/// Color dodge (W3C).
vec3 xt_blendColorDodge(vec3 base, vec3 blend) {
  vec3 dodge = min(vec3(1.0), base / max(1.0 - blend, 1e-6));
  vec3 result = mix(dodge, vec3(1.0), greaterThanEqual(blend, vec3(1.0)));
  return clamp(mix(result, vec3(0.0), lessThanEqual(base, vec3(0.0))), 0.0, 1.0);
}

/// Add (linear dodge). Not clamped, so it is safe for HDR glow.
vec3 xt_blendAdd(vec3 base, vec3 blend) {
  return base + blend;
}

/// Hard light (W3C).
vec3 xt_blendHardLight(vec3 base, vec3 blend) {
  vec3 multiply = base * (2.0 * blend);
  vec3 screen = xt_blendScreen(base, 2.0 * blend - 1.0);
  return mix(screen, multiply, lessThanEqual(blend, vec3(0.5)));
}

/// Overlay: hard light with base and blend swapped (W3C).
vec3 xt_blendOverlay(vec3 base, vec3 blend) {
  return xt_blendHardLight(blend, base);
}

/// Soft light (W3C formula).
vec3 xt_blendSoftLight(vec3 base, vec3 blend) {
  vec3 d = mix(sqrt(max(base, 0.0)), ((16.0 * base - 12.0) * base + 4.0) * base, lessThanEqual(base, vec3(0.25)));
  vec3 darker = base - (1.0 - 2.0 * blend) * base * (1.0 - base);
  vec3 lighter = base + (2.0 * blend - 1.0) * (d - base);
  return clamp(mix(lighter, darker, lessThanEqual(blend, vec3(0.5))), 0.0, 1.0);
}

/// Vivid light: color burn below 0.5, color dodge above.
vec3 xt_blendVividLight(vec3 base, vec3 blend) {
  vec3 burn = xt_blendColorBurn(base, 2.0 * blend);
  vec3 dodge = xt_blendColorDodge(base, 2.0 * blend - 1.0);
  return mix(dodge, burn, lessThanEqual(blend, vec3(0.5)));
}

/// Linear light: base + 2 * blend - 1, clamped.
vec3 xt_blendLinearLight(vec3 base, vec3 blend) {
  return clamp(base + 2.0 * blend - 1.0, 0.0, 1.0);
}

/// Pin light: darken below 0.5, lighten above.
vec3 xt_blendPinLight(vec3 base, vec3 blend) {
  vec3 darken = min(base, 2.0 * blend);
  vec3 lighten = max(base, 2.0 * blend - 1.0);
  return clamp(mix(lighten, darken, lessThanEqual(blend, vec3(0.5))), 0.0, 1.0);
}

/// Hard mix: 1 where base + blend >= 1, otherwise 0.
vec3 xt_blendHardMix(vec3 base, vec3 blend) {
  return step(1.0, base + blend);
}

/// Difference.
vec3 xt_blendDifference(vec3 base, vec3 blend) {
  return abs(base - blend);
}

/// Exclusion.
vec3 xt_blendExclusion(vec3 base, vec3 blend) {
  return base + blend - 2.0 * base * blend;
}

/// Subtract: base - blend, floored at 0.
vec3 xt_blendSubtract(vec3 base, vec3 blend) {
  return max(base - blend, 0.0);
}

/// Divide: base / blend, clamped. A zero blend gives white wherever the base is above zero.
vec3 xt_blendDivide(vec3 base, vec3 blend) {
  vec3 divided = base / max(blend, 1e-6);
  return clamp(mix(divided, step(1e-6, base), lessThanEqual(blend, vec3(0.0))), 0.0, 1.0);
}

/// Luminosity used by the non-separable modes (W3C Lum).
float xt_blendLum(vec3 c) {
  return dot(c, vec3(0.3, 0.59, 0.11));
}

/// W3C ClipColor: brings a color back into gamut while keeping its luminosity.
vec3 xt_blendClipColor(vec3 c) {
  float l = xt_blendLum(c);
  float n = min(c.r, min(c.g, c.b));
  float x = max(c.r, max(c.g, c.b));
  if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-6);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6);
  return c;
}

/// W3C SetLum: gives `c` the luminosity `l`.
vec3 xt_blendSetLum(vec3 c, float l) {
  return xt_blendClipColor(c + (l - xt_blendLum(c)));
}

/// W3C Sat: max channel minus min channel.
float xt_blendSat(vec3 c) {
  return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
}

/// W3C SetSat: gives `c` the saturation `s` while preserving channel order.
vec3 xt_blendSetSat(vec3 c, float s) {
  float maxc = max(c.r, max(c.g, c.b));
  float minc = min(c.r, min(c.g, c.b));
  float range = maxc - minc;
  return range > 1e-6 ? (c - minc) * s / range : vec3(0.0);
}

/// Hue: hue of the blend with the saturation and luminosity of the base.
vec3 xt_blendHue(vec3 base, vec3 blend) {
  return xt_blendSetLum(xt_blendSetSat(blend, xt_blendSat(base)), xt_blendLum(base));
}

/// Saturation: saturation of the blend with the hue and luminosity of the base.
vec3 xt_blendSaturation(vec3 base, vec3 blend) {
  return xt_blendSetLum(xt_blendSetSat(base, xt_blendSat(blend)), xt_blendLum(base));
}

/// Color: hue and saturation of the blend with the luminosity of the base.
vec3 xt_blendColor(vec3 base, vec3 blend) {
  return xt_blendSetLum(blend, xt_blendLum(base));
}

/// Luminosity: luminosity of the blend with the hue and saturation of the base.
vec3 xt_blendLuminosity(vec3 base, vec3 blend) {
  return xt_blendSetLum(base, xt_blendLum(blend));
}

/// Darker color: whichever whole color has the lower luminosity.
vec3 xt_blendDarkerColor(vec3 base, vec3 blend) {
  return xt_blendLum(blend) < xt_blendLum(base) ? blend : base;
}

/// Lighter color: whichever whole color has the higher luminosity.
vec3 xt_blendLighterColor(vec3 base, vec3 blend) {
  return xt_blendLum(blend) > xt_blendLum(base) ? blend : base;
}

/// Blends with a runtime mode (one of the XT_BLEND_* constants). Unknown modes return `blend`.
vec3 xt_blend(int mode, vec3 base, vec3 blend) {
  if (mode == XT_BLEND_DARKEN) return xt_blendDarken(base, blend);
  if (mode == XT_BLEND_MULTIPLY) return xt_blendMultiply(base, blend);
  if (mode == XT_BLEND_COLOR_BURN) return xt_blendColorBurn(base, blend);
  if (mode == XT_BLEND_LINEAR_BURN) return xt_blendLinearBurn(base, blend);
  if (mode == XT_BLEND_DARKER_COLOR) return xt_blendDarkerColor(base, blend);
  if (mode == XT_BLEND_LIGHTEN) return xt_blendLighten(base, blend);
  if (mode == XT_BLEND_SCREEN) return xt_blendScreen(base, blend);
  if (mode == XT_BLEND_COLOR_DODGE) return xt_blendColorDodge(base, blend);
  if (mode == XT_BLEND_ADD) return xt_blendAdd(base, blend);
  if (mode == XT_BLEND_LIGHTER_COLOR) return xt_blendLighterColor(base, blend);
  if (mode == XT_BLEND_OVERLAY) return xt_blendOverlay(base, blend);
  if (mode == XT_BLEND_SOFT_LIGHT) return xt_blendSoftLight(base, blend);
  if (mode == XT_BLEND_HARD_LIGHT) return xt_blendHardLight(base, blend);
  if (mode == XT_BLEND_VIVID_LIGHT) return xt_blendVividLight(base, blend);
  if (mode == XT_BLEND_LINEAR_LIGHT) return xt_blendLinearLight(base, blend);
  if (mode == XT_BLEND_PIN_LIGHT) return xt_blendPinLight(base, blend);
  if (mode == XT_BLEND_HARD_MIX) return xt_blendHardMix(base, blend);
  if (mode == XT_BLEND_DIFFERENCE) return xt_blendDifference(base, blend);
  if (mode == XT_BLEND_EXCLUSION) return xt_blendExclusion(base, blend);
  if (mode == XT_BLEND_SUBTRACT) return xt_blendSubtract(base, blend);
  if (mode == XT_BLEND_DIVIDE) return xt_blendDivide(base, blend);
  if (mode == XT_BLEND_HUE) return xt_blendHue(base, blend);
  if (mode == XT_BLEND_SATURATION) return xt_blendSaturation(base, blend);
  if (mode == XT_BLEND_COLOR) return xt_blendColor(base, blend);
  if (mode == XT_BLEND_LUMINOSITY) return xt_blendLuminosity(base, blend);
  return blend;
}

/// Blends with a runtime mode, then mixes the result over `base` by `opacity`.
vec3 xt_blend(int mode, vec3 base, vec3 blend, float opacity) {
  return mix(base, xt_blend(mode, base, blend), opacity);
}
