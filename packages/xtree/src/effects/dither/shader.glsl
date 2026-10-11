// Ordered and noise dithering to a few levels per channel.
#include <xtree/color/space>
#include <xtree/noise/blue>
#include <xtree/dither/ordered>

vec4 $main(vec4 color, vec2 uv) {
  ivec2 cell = ivec2(floor(uv * xt_resolution / $scale));
  float threshold;
  if ($pattern == $pattern_bayer2) {
    threshold = xt_bayer(cell, 1);
  } else if ($pattern == $pattern_bayer4) {
    threshold = xt_bayer(cell, 2);
  } else if ($pattern == $pattern_bayer8) {
    threshold = xt_bayer(cell, 3);
  } else if ($pattern == $pattern_noise) {
    threshold = xt_ign(vec2(cell) + 0.5);
  } else {
#if $has_noise
    threshold = (texelFetch($noise, cell % textureSize($noise, 0), 0).r * 255.0 + 0.5) / 256.0;
#else
    threshold = xt_ign(vec2(cell) + 0.5);
#endif
  }
  vec3 c = clamp(xt_linearToSrgb(max(color.rgb, 0.0)), 0.0, 1.0);
  if ($grayscale) c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)));
  vec3 quantized = xt_quantize(c, float($levels), threshold);
  return vec4(xt_srgbToLinear(mix(c, quantized, $amount)), color.a);
}
