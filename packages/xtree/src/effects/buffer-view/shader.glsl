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
  vec3 p = xt_worldPosition(uv);
  vec3 grid = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  float line = 1.0 - clamp(min(grid.x, min(grid.y, grid.z)), 0.0, 1.0);
  shown = xt_depth(uv) >= 1.0 ? vec3(0.0) : mix(fract(p * 0.25) * 0.6, vec3(1.0), line);
#else
  shown = vec3($maskAt(uv));
#endif
  // Shown values are display values, so undo the output stage's sRGB encoding.
  return vec4(xt_srgbToLinear(shown), color.a);
}
