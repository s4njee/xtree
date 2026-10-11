/**
 * Uniformly distributed unit gradients for integer lattice points, shared by
 * the gradient and simplex noises.
 */

#include <xtree/noise/hash>

/// Unit gradient for a 2D lattice point.
vec2 xt_gradient2(ivec2 c) {
  float angle = xt_latticeHash(ivec3(c, 0)).x * 6.28318530718;
  return vec2(cos(angle), sin(angle));
}

/// Unit gradient for a 3D lattice point.
vec3 xt_gradient3(ivec3 c) {
  vec2 h = xt_latticeHash(c).xy;
  float z = h.x * 2.0 - 1.0;
  float angle = h.y * 6.28318530718;
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(angle), r * sin(angle), z);
}

/// Unit gradient for a 4D lattice point (Shoemake's uniform 3-sphere sampling).
vec4 xt_gradient4(ivec4 c) {
  vec3 h = xt_latticeHash(c).xyz;
  float a = sqrt(1.0 - h.x);
  float b = sqrt(h.x);
  float t1 = h.y * 6.28318530718;
  float t2 = h.z * 6.28318530718;
  return vec4(a * sin(t1), a * cos(t1), b * sin(t2), b * cos(t2));
}
