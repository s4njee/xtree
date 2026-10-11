// Levels: input black and white points, a midtone gamma, then output black and white points, on display-encoded values.
#include <xtree/color/space>

vec3 $levels(vec3 c) {
  // No upper clamp: HDR values above white stay above it for tone mapping to handle.
  vec3 t = max((c - $inputBlack) / max($inputWhite - $inputBlack, 1e-4), 0.0);
  t = pow(t, vec3(1.0 / $gamma));
  return mix(vec3($outputBlack), vec3($outputWhite), t);
}

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  vec3 adjusted = $levels(c);
#if $channel == $channel_red
  c.r = adjusted.r;
#elif $channel == $channel_green
  c.g = adjusted.g;
#elif $channel == $channel_blue
  c.b = adjusted.b;
#else
  c = adjusted;
#endif
  return vec4(xt_srgbToLinear(c), color.a);
}
