/**
 * Tone mapping operators matching three.js r186 (`tonemapping_pars_fragment`),
 * with exposure as an argument instead of a uniform. Inputs and outputs are
 * linear sRGB. Ported from three.js (MIT). AgX follows Filament (Apache-2.0)
 * and the minimal AgX contrast curve published by iolite; Neutral is the
 * Khronos PBR Neutral operator.
 */

/// Exposure-only tone mapping, clamped to [0, 1].
vec3 xt_tonemapLinear(vec3 color, float exposure) {
  return clamp(exposure * color, 0.0, 1.0);
}

/// Simple Reinhard: c / (1 + c).
vec3 xt_tonemapReinhard(vec3 color, float exposure) {
  color *= exposure;
  return clamp(color / (vec3(1.0) + color), 0.0, 1.0);
}

/// Optimized Cineon filmic operator (Hejl and Burgess-Dawson).
vec3 xt_tonemapCineon(vec3 color, float exposure) {
  color *= exposure;
  color = max(vec3(0.0), color - 0.004);
  return pow((color * (6.2 * color + 0.5)) / (color * (6.2 * color + 1.7) + 0.06), vec3(2.2));
}

/// ACES RRT + ODT curve fit (Stephen Hill).
vec3 xt_acesRrtOdtFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

/// ACES filmic, including three.js's 1/0.6 exposure scale for brighter viewing environments.
vec3 xt_tonemapAces(vec3 color, float exposure) {
  const mat3 inputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 outputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602)
  );
  color *= exposure / 0.6;
  color = inputMat * color;
  color = xt_acesRrtOdtFit(color);
  color = outputMat * color;
  return clamp(color, 0.0, 1.0);
}

/// Minimal AgX default contrast curve (sixth-order polynomial fit).
vec3 xt_agxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

/// AgX with Rec.2020 working primaries.
vec3 xt_tonemapAgx(vec3 color, float exposure) {
  const mat3 rec2020ToSrgb = mat3(
    vec3(1.6605, -0.1246, -0.0182),
    vec3(-0.5876, 1.1329, -0.1006),
    vec3(-0.0728, -0.0083, 1.1187)
  );
  const mat3 srgbToRec2020 = mat3(
    vec3(0.6274, 0.0691, 0.0164),
    vec3(0.3293, 0.9195, 0.0880),
    vec3(0.0433, 0.0113, 0.8956)
  );
  const mat3 inset = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859)
  );
  const mat3 outset = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405)
  );
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  color *= exposure;
  color = srgbToRec2020 * color;
  color = inset * color;
  color = max(color, 1e-10);
  color = log2(color);
  color = (color - minEv) / (maxEv - minEv);
  color = clamp(color, 0.0, 1.0);
  color = xt_agxContrast(color);
  color = outset * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  color = rec2020ToSrgb * color;
  return clamp(color, 0.0, 1.0);
}

/// Khronos PBR Neutral: keeps base colors accurate and compresses only highlights.
vec3 xt_tonemapNeutral(vec3 color, float exposure) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  color *= exposure;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
