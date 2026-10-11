// Scanline tear: bands of lines slip sideways, wrapping around like a lost horizontal sync.
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  float line = floor(uv.y * xt_resolution.y / $lineHeight);
  float stepIndex = floor(xt_time * 10.0);
  float torn = step(1.0 - $frequency, xt_hash1(vec2(line, stepIndex + float($seed))));
  float jump = (xt_hash1(vec2(line, stepIndex + float($seed) + 7.0)) - 0.5) * 2.0;
  float wobble = sin(uv.y * 40.0 + xt_time * $speed * 6.28318530718) * $wave;
  float offset = $amount * (jump * torn + wobble * 0.25);
  return xt_sample(vec2(fract(uv.x + offset), uv.y));
}
