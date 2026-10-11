// Bit crush: fewer bits per channel on display-encoded values, optionally ordered-dithered, and an optional lower sample resolution.
#include <xtree/color/space>
#include <xtree/dither/ordered>

vec4 $main(vec4 color, vec2 uv) {
  vec2 pixel = floor(uv * xt_resolution / $downsample);
  vec4 source = $downsample > 1.0 ? xt_sample((pixel + 0.5) * $downsample / xt_resolution) : color;
  vec3 c = clamp(xt_linearToSrgb(max(source.rgb, 0.0)), 0.0, 1.0);
  float levels = exp2($bits);
  float threshold = $dither ? xt_bayer(ivec2(pixel), 2) : 0.5;
  vec3 crushed = xt_quantize(c, levels, threshold);
  return vec4(mix(source.rgb, xt_srgbToLinear(crushed), $amount), source.a);
}
