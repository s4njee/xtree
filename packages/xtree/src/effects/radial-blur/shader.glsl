// Radial blur: averages samples along the line toward a center (zoom) or along an arc around it (spin).
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  vec2 offset = (uv - $center) * aspect;
  // A per-pixel jitter of the start trades banding for fine noise.
  float jitter = xt_hash1(floor(uv * xt_resolution) + 0.5) - 0.5;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 64; i++) {
    if (i >= $samples) break;
    float t = (float(i) + 0.5 + jitter * 0.9) / float($samples) - 0.5;
    vec2 p;
#if $mode == $mode_spin
    float angle = t * $strength * 0.6;
    float c = cos(angle);
    float s = sin(angle);
    p = mat2(c, s, -s, c) * offset;
#else
    p = offset * (1.0 - t * $strength);
#endif
    sum += xt_sample($center + p / aspect);
  }
  return sum / float($samples);
}
