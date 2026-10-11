// Hue, saturation and lightness in OKLCH, so hue shifts keep perceived lightness.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  vec3 lch = xt_linearToOklch(max(color.rgb, 0.0));
  if ($colorize) {
    lch.y = $colorizeChroma;
    lch.z = fract($colorizeHue / 360.0);
  } else {
    lch.z = fract(lch.z + $hue / 360.0);
    lch.y *= 1.0 + $saturation;
  }
  lch.x = $lightness >= 0.0 ? mix(lch.x, 1.0, $lightness) : lch.x * (1.0 + $lightness);
  return vec4(max(xt_oklchToLinear(lch), 0.0), color.a);
}
