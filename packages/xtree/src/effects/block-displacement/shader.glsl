// Block displacement: random rectangles jump sideways with a little channel separation.
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  float seed = float($seed);
  float on = 1.0;
  if ($trigger == $trigger_bursts) on = step(xt_hash1(vec2(floor(xt_time * 1.5), seed + 3.0)), 0.4);
  // Two overlapping grids give blocks of varied widths.
  vec2 blocks = xt_resolution / vec2($blockSize * 2.0, $blockSize);
  vec2 cell = floor(uv * blocks);
  vec2 wide = floor(uv * blocks * vec2(0.25, 1.0));
  // Each block changes on its own phase, so the frame never flips all at once
  // (large simultaneous changes are what count as flashes under WCAG 2.3.1).
  float phase = xt_hash1(vec3(cell, seed + 11.0));
  float stepIndex = floor(xt_time * $rate + phase);
  vec3 h = xt_hash3(vec3(cell, stepIndex + seed * 13.0));
  float pick = xt_hash1(vec3(wide, stepIndex + seed * 7.0));
  float hit = step(1.0 - $density, max(h.x, pick * 0.8)) * on;
  vec2 offset = vec2(h.y - 0.5, (h.z - 0.5) * 0.25) * $amount * 0.3 * hit;
  vec2 st = clamp(uv + offset, 0.0, 1.0);
  float shift = $colorShift * hit;
  return vec4(xt_sample(st + vec2(shift, 0.0)).r, xt_sample(st).g, xt_sample(st - vec2(shift, 0.0)).b, color.a);
}
