// Ordered and noise dithering to a few levels per channel.
#include <xtree/color/space>
#include <xtree/noise/blue>

// Bayer threshold for a 2^n × 2^n matrix, from the bits of the cell coordinates.
float $bayer(ivec2 p, int n) {
  int value = 0;
  for (int i = 0; i < n; i++) {
    int x = (p.x >> i) & 1;
    int y = (p.y >> i) & 1;
    value |= (((x ^ y) << 1) | y) << (2 * (n - 1 - i));
  }
  return (float(value) + 0.5) / float(1 << (2 * n));
}

vec4 $main(vec4 color, vec2 uv) {
  ivec2 cell = ivec2(floor(uv * xt_resolution / $scale));
  float threshold;
  if ($pattern == $pattern_bayer2) {
    threshold = $bayer(cell, 1);
  } else if ($pattern == $pattern_bayer4) {
    threshold = $bayer(cell, 2);
  } else if ($pattern == $pattern_bayer8) {
    threshold = $bayer(cell, 3);
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
  float steps = float($levels - 1);
  vec3 quantized = floor(c * steps + threshold) / steps;
  return vec4(xt_srgbToLinear(mix(c, clamp(quantized, 0.0, 1.0), $amount)), color.a);
}
