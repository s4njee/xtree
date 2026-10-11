// Flow warp: the image advected through a slowly changing curl-noise flow field, so it swirls like liquid without tearing.
#include <xtree/noise/simplex>

// The 2D curl of a simplex potential that drifts through time: divergence-free, so the image swirls without bunching up.
vec2 $flow(vec2 p, float t) {
  const float e = 0.01;
  float dx = xt_simplex(xt_seeded(vec3(p + vec2(e, 0.0), t), $seed)) - xt_simplex(xt_seeded(vec3(p - vec2(e, 0.0), t), $seed));
  float dy = xt_simplex(xt_seeded(vec3(p + vec2(0.0, e), t), $seed)) - xt_simplex(xt_seeded(vec3(p - vec2(0.0, e), t), $seed));
  return vec2(dy, -dx) / (2.0 * e);
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  vec2 p = uv * aspect;
  float t = xt_time * $speed * 0.2;
  // A few Euler steps along the flow give curving, coherent displacement.
  for (int i = 0; i < 4; i++) p += $flow(p * $scale, t) * $strength * 0.0025;
  return xt_sample(p / aspect);
}
