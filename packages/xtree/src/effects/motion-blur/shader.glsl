// Motion blur: averages samples along each pixel's screen-space motion from the velocity buffer, centered on the pixel, as a camera shutter open for part of a frame.
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  vec2 velocity = xt_velocity(uv) * $intensity;
  // Cap the blur length so very fast motion doesn't smear across the frame.
  float len = length(velocity);
  if (len > $maxBlur) velocity *= $maxBlur / len;
  if (len * min(xt_resolution.x, xt_resolution.y) < 0.5) return color;
  float jitter = xt_hash1(floor(uv * xt_resolution) + 0.5) - 0.5;
  vec4 sum = color;
  float weight = 1.0;
  for (int i = 0; i < 32; i++) {
    if (i >= $samples) break;
    float t = (float(i) + 0.5 + jitter * 0.9) / float($samples) - 0.5;
    vec2 st = uv - velocity * t;
    // Samples from still background don't smear into moving objects' edges as much.
    float w = clamp(length(xt_velocity(st)) / max(len, 1e-5) + 0.25, 0.25, 1.0);
    sum += xt_sample(st) * w;
    weight += w;
  }
  return sum / weight;
}
