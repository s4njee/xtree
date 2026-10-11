// Slice shift: the frame cut into bands that slide sideways (or up and down) by random amounts, changing on staggered steps.
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  float along = $vertical ? uv.x : uv.y;
  float slice = floor(along * $slices);
  // Each slice changes on its own phase, so the frame never jumps all at once (WCAG 2.3.1).
  float stepIndex = floor(xt_time * $rate + xt_hash1(vec2(slice, float($seed) + 5.0)));
  float h = xt_hash1(vec2(slice, stepIndex + float($seed)));
  float moved = step(1.0 - $density, xt_hash1(vec2(slice + 11.0, stepIndex + float($seed))));
  float offset = (h - 0.5) * 2.0 * $offset * moved;
  vec2 st = $vertical ? vec2(uv.x, fract(uv.y + offset)) : vec2(fract(uv.x + offset), uv.y);
  return xt_sample(st);
}
