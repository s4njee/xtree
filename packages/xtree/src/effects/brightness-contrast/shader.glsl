// Brightness, contrast, saturation and vibrance, applied to display-encoded values.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  c += $brightness;
  c = (c - 0.5) * (1.0 + $contrast) + 0.5;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, 1.0 + $saturation);
  // Vibrance raises saturation more where colors are muted.
  float spread = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(luma), c, 1.0 + $vibrance * (1.0 - clamp(spread, 0.0, 1.0)));
  return vec4(xt_srgbToLinear(max(c, 0.0)), color.a);
}
