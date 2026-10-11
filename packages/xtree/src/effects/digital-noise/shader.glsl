// Digital noise: static per cell, with occasional brighter noise bands.
#include <xtree/color/space>
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  float frame = floor(xt_time * $rate);
  // Cells from integer pixel centers: a center on a cell boundary must land the same way on every GPU.
  vec2 px = floor(uv * xt_resolution) + 0.5;
  vec2 cell = floor(px / $size + 1e-3);
  vec3 n = xt_hash3(xt_seeded(vec3(cell, frame), $seed));
  vec3 noise = $mode == $mode_color ? n : vec3(n.x);
  float band = step(1.0 - $bands * 0.3, xt_hash1(xt_seeded(vec2(floor(px.y / (3.0 * $size) + 1e-3), frame), $seed)));
  float k = clamp($amount * (1.0 + band * 2.0), 0.0, 1.0);
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  c += (noise - 0.5) * k;
  return vec4(xt_srgbToLinear(max(c, 0.0)), color.a);
}
