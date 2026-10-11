// Film grain: per-cell noise, strongest in shadows and midtones, refreshed at a film frame rate.
#include <xtree/color/space>
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  // Cells from integer pixel centers: a center on a cell boundary must land the same way on every GPU.
  vec2 px = floor(uv * xt_resolution) + 0.5;
  vec2 cell = floor(px / $size + 1e-3);
  float frame = $animated ? floor(xt_time * $speed) : 0.0;
  // The sum of two uniforms approximates the bell-shaped grain distribution.
  vec3 n = xt_hash3(xt_seeded(vec3(cell, frame), $seed)) + xt_hash3(xt_seeded(vec3(cell + 97.0, frame), $seed)) - 1.0;
  vec3 grain = $colored ? n : vec3(n.x);
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  float luma = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  float response = mix(1.0, 1.0 - smoothstep(0.35, 1.0, luma), $luminanceResponse);
  c += grain * $intensity * response;
  return vec4(xt_srgbToLinear(max(c, 0.0)), color.a);
}
