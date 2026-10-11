/**
 * Classic gradient (Perlin) noise with hashed unit gradients and quintic
 * interpolation (Perlin, "Improving Noise", SIGGRAPH 2002). Output is in
 * [-1, 1] and is zero at every integer lattice point.
 */

#include <xtree/noise/gradient>
#include <xtree/noise/value>

/// 2D gradient noise in [-1, 1].
float xt_perlin(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = xt_quintic(f);
  float a = dot(xt_gradient2(i), f);
  float b = dot(xt_gradient2(i + ivec2(1, 0)), f - vec2(1.0, 0.0));
  float c = dot(xt_gradient2(i + ivec2(0, 1)), f - vec2(0.0, 1.0));
  float d = dot(xt_gradient2(i + ivec2(1, 1)), f - vec2(1.0, 1.0));
  // sqrt(2) rescales the theoretical bound sqrt(N)/2 to 1.
  return 1.41421356237 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/// 3D gradient noise in [-1, 1].
float xt_perlin(vec3 p) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  vec3 u = xt_quintic(f);
  float a = dot(xt_gradient3(i), f);
  float b = dot(xt_gradient3(i + ivec3(1, 0, 0)), f - vec3(1.0, 0.0, 0.0));
  float c = dot(xt_gradient3(i + ivec3(0, 1, 0)), f - vec3(0.0, 1.0, 0.0));
  float d = dot(xt_gradient3(i + ivec3(1, 1, 0)), f - vec3(1.0, 1.0, 0.0));
  float e = dot(xt_gradient3(i + ivec3(0, 0, 1)), f - vec3(0.0, 0.0, 1.0));
  float g = dot(xt_gradient3(i + ivec3(1, 0, 1)), f - vec3(1.0, 0.0, 1.0));
  float h = dot(xt_gradient3(i + ivec3(0, 1, 1)), f - vec3(0.0, 1.0, 1.0));
  float k = dot(xt_gradient3(i + ivec3(1, 1, 1)), f - vec3(1.0, 1.0, 1.0));
  // 2 / sqrt(3) rescales the theoretical bound sqrt(N)/2 to 1.
  return 1.15470053838 * mix(
    mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
    mix(mix(e, g, u.x), mix(h, k, u.x), u.y),
    u.z
  );
}
