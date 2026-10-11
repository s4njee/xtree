/**
 * Value noise: smoothly interpolated random values on an integer lattice.
 * Output is in [0, 1]. Uses quintic interpolation, so the first and second
 * derivatives are continuous.
 */

#include <xtree/noise/hash>

/// Quintic smoothstep used by lattice noises: 6t^5 - 15t^4 + 10t^3.
vec2 xt_quintic(vec2 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
vec3 xt_quintic(vec3 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/// 2D value noise in [0, 1].
float xt_valueNoise(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 u = xt_quintic(fract(p));
  float a = xt_latticeHash(ivec3(i, 0)).x;
  float b = xt_latticeHash(ivec3(i + ivec2(1, 0), 0)).x;
  float c = xt_latticeHash(ivec3(i + ivec2(0, 1), 0)).x;
  float d = xt_latticeHash(ivec3(i + ivec2(1, 1), 0)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/// 3D value noise in [0, 1].
float xt_valueNoise(vec3 p) {
  ivec3 i = ivec3(floor(p));
  vec3 u = xt_quintic(fract(p));
  float a = xt_latticeHash(i).x;
  float b = xt_latticeHash(i + ivec3(1, 0, 0)).x;
  float c = xt_latticeHash(i + ivec3(0, 1, 0)).x;
  float d = xt_latticeHash(i + ivec3(1, 1, 0)).x;
  float e = xt_latticeHash(i + ivec3(0, 0, 1)).x;
  float f = xt_latticeHash(i + ivec3(1, 0, 1)).x;
  float g = xt_latticeHash(i + ivec3(0, 1, 1)).x;
  float h = xt_latticeHash(i + ivec3(1, 1, 1)).x;
  return mix(
    mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
    mix(mix(e, f, u.x), mix(g, h, u.x), u.y),
    u.z
  );
}
