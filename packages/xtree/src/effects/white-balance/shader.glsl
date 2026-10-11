// White balance: a Bradford chromatic adaptation from a chosen color temperature and tint to D65, in linear light.
#include <xtree/color/white-balance>

vec4 $main(vec4 color, vec2 uv) {
  // Strong adaptations push saturated colors out of gamut; clip at zero.
  vec3 balanced = max(xt_whiteBalance(max(color.rgb, 0.0), $temperature, $tint), 0.0);
  return vec4(mix(color.rgb, balanced, $amount), color.a);
}
