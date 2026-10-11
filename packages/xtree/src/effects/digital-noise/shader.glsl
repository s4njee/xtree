// Digital noise: static per cell, with occasional brighter noise bands.
#include <xtree/color/space>
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  float frame = floor(xt_time * $rate);
  vec2 cell = floor(uv * xt_resolution / $size);
  vec3 n = xt_hash3(vec3(cell, frame));
  vec3 noise = $mode == $mode_color ? n : vec3(n.x);
  float band = step(1.0 - $bands * 0.3, xt_hash1(vec2(floor(uv.y * xt_resolution.y / (3.0 * $size)), frame)));
  float k = clamp($amount * (1.0 + band * 2.0), 0.0, 1.0);
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  c += (noise - 0.5) * k;
  return vec4(xt_srgbToLinear(max(c, 0.0)), color.a);
}
