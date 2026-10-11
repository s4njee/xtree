// Emboss: the brightness gradient along a light direction, as a raised relief in grey or tinted by the image.
#include <xtree/color/space>

float $luma(vec2 uv) {
  return dot(clamp(xt_linearToSrgb(max(xt_sample(uv).rgb, 0.0)), 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
}

vec4 $main(vec4 color, vec2 uv) {
  float a = radians($angle);
  vec2 d = vec2(cos(a), sin(a)) * xt_texel * $distance;
  float relief = ($luma(uv + d) - $luma(uv - d)) * $strength;
  vec3 c = clamp(xt_linearToSrgb(max(color.rgb, 0.0)), 0.0, 1.0);
  vec3 embossed = $colored ? clamp(c + relief, 0.0, 1.0) : vec3(clamp(0.5 + relief, 0.0, 1.0));
  // Mixed in linear light, so amount 0 leaves HDR values untouched.
  return vec4(mix(color.rgb, xt_srgbToLinear(embossed), $amount), color.a);
}
