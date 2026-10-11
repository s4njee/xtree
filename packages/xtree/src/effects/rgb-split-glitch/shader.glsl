// RGB split glitch: shifts red and blue apart in steps that jump a few times a second.
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  // Jitter changes `rate` times per second; bursts switch on and off over slower windows.
  float stepIndex = floor(xt_time * $rate);
  vec3 h = xt_hash3(vec2(stepIndex, float($seed)));
  float glitching = 1.0;
  if ($trigger == $trigger_bursts) {
    float window = floor(xt_time * 1.5);
    glitching = step(xt_hash1(vec2(window, float($seed) + 17.0)), $burstChance);
  }
  float amount = $amount * glitching * (1.0 + (h.x - 0.5) * 2.0 * $jitter);
  float angle = radians($angle) + (h.y - 0.5) * $jitter * 3.14159265;
  vec2 offset = vec2(cos(angle), sin(angle)) * amount * vec2(xt_resolution.y / xt_resolution.x, 1.0);
  return vec4(xt_sample(uv + offset).r, color.g, xt_sample(uv - offset).b, color.a);
}
