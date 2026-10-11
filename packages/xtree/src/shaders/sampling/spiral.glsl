/**
 * Sample patterns for gathers such as depth of field: a golden-angle spiral
 * that fills a disk evenly (Vogel, 1979) and a 16-point Poisson disk.
 */

/// The golden angle in radians, the step between spiral samples.
const float XT_GOLDEN_ANGLE = 2.39996323;

/// Offset of sample i of n on a golden-angle spiral filling the unit disk evenly.
vec2 xt_spiral(int i, int n) {
  float r = sqrt((float(i) + 0.5) / float(n));
  float a = float(i) * XT_GOLDEN_ANGLE;
  return r * vec2(cos(a), sin(a));
}

/// Point i (0–15) of a Poisson disk in the unit disk, minimum spacing about 0.35.
vec2 xt_poissonDisk(int i) {
  const vec2 points[16] = vec2[16](
    vec2(-0.94201624, -0.39906216), vec2(0.94558609, -0.76890725),
    vec2(-0.09418410, -0.92938870), vec2(0.34495938, 0.29387760),
    vec2(-0.91588581, 0.45771432), vec2(-0.81544232, -0.87912464),
    vec2(-0.38277543, 0.27676845), vec2(0.97484398, 0.75648379),
    vec2(0.44323325, -0.97511554), vec2(0.53742981, -0.47373420),
    vec2(-0.26496911, -0.41893023), vec2(0.79197514, 0.19090188),
    vec2(-0.24188840, 0.99706507), vec2(-0.81409955, 0.91437590),
    vec2(0.19984126, 0.78641367), vec2(0.14383161, -0.14100790)
  );
  return points[i & 15];
}
