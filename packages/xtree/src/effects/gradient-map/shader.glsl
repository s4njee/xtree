// Gradient map: replaces each pixel by a three-stop gradient indexed by its luma.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  float luma = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  vec3 low = xt_linearToSrgb($shadows);
  vec3 mid = xt_linearToSrgb($midtones);
  vec3 high = xt_linearToSrgb($highlights);
  vec3 mapped = luma < $midpoint ? mix(low, mid, luma / $midpoint) : mix(mid, high, (luma - $midpoint) / (1.0 - $midpoint));
  return vec4(xt_srgbToLinear(mix(c, mapped, $amount)), color.a);
}
