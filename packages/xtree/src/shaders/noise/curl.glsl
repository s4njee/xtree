/**
 * Curl noise: divergence-free flow fields built from simplex potentials
 * (Bridson, Hourihan and Nordenstam, "Curl-Noise for Procedural Fluid Flow",
 * SIGGRAPH 2007). Derivatives use central differences.
 */

#include <xtree/noise/simplex>

/// 2D curl noise: the rotated gradient of a scalar simplex potential.
vec2 xt_curl(vec2 p) {
  const float e = 0.005;
  float dx = xt_simplex(p + vec2(e, 0.0)) - xt_simplex(p - vec2(e, 0.0));
  float dy = xt_simplex(p + vec2(0.0, e)) - xt_simplex(p - vec2(0.0, e));
  return vec2(dy, -dx) / (2.0 * e);
}

/// Three decorrelated simplex values used as a vector potential.
vec3 xt_curlPotential(vec3 p) {
  return vec3(
    xt_simplex(p),
    xt_simplex(p + vec3(31.416, -47.853, 12.793)),
    xt_simplex(p + vec3(-233.145, -113.408, -185.31))
  );
}

/// 3D curl noise: the curl of a vector potential made of three simplex fields.
vec3 xt_curl(vec3 p) {
  const float e = 0.005;
  vec3 dx = xt_curlPotential(p + vec3(e, 0.0, 0.0)) - xt_curlPotential(p - vec3(e, 0.0, 0.0));
  vec3 dy = xt_curlPotential(p + vec3(0.0, e, 0.0)) - xt_curlPotential(p - vec3(0.0, e, 0.0));
  vec3 dz = xt_curlPotential(p + vec3(0.0, 0.0, e)) - xt_curlPotential(p - vec3(0.0, 0.0, e));
  return vec3(dy.z - dz.y, dz.x - dx.z, dx.y - dy.x) / (2.0 * e);
}
