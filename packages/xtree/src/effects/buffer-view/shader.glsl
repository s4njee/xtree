// Buffer view: displays one geometry buffer (or this effect's mask) in place of the image.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  vec3 shown;
#if $buffer == $buffer_depth
  shown = vec3(xt_depth(uv) >= 1.0 ? 1.0 : clamp(xt_viewDepth(uv) / $range, 0.0, 1.0));
#elif $buffer == $buffer_normal
  vec3 n = xt_viewNormal(uv);
  shown = n == vec3(0.0) ? vec3(0.0) : n * 0.5 + 0.5;
#elif $buffer == $buffer_reconstructedNormal
  shown = xt_depth(uv) >= 1.0 ? vec3(0.0) : xt_normalFromDepth(xt_depthBuffer, uv, xt_texel, xt_inverseProjection) * 0.5 + 0.5;
#elif $buffer == $buffer_position
  // A smooth ramp (no grid lines), so the view is stable across GPUs: ±range maps to 0–1.
  vec3 p = xt_worldPosition(uv);
  shown = xt_depth(uv) >= 1.0 ? vec3(0.0) : clamp(p / $range * 0.5 + 0.5, 0.0, 1.0);
#else
  shown = vec3($maskAt(uv));
#endif
  // Shown values are display values, so undo the output stage's sRGB encoding.
  return vec4(xt_srgbToLinear(shown), color.a);
}
