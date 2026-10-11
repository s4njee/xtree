// Directional blur: averages samples along a line at an angle, like a fast pan.
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  float angle = radians($angle);
  vec2 step = vec2(cos(angle), sin(angle)) * $length / xt_resolution;
  float jitter = xt_hash1(floor(uv * xt_resolution) + 0.5) - 0.5;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 64; i++) {
    if (i >= $samples) break;
    float t = (float(i) + 0.5 + jitter * 0.9) / float($samples) - 0.5;
    sum += xt_sample(uv + step * t);
  }
  return sum / float($samples);
}
