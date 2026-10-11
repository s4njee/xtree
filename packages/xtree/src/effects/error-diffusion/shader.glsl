// Error-diffusion dithering, approximated on the GPU: each pixel replays Floyd–Steinberg (or Atkinson) diffusion in scanline order over its 4×4 tile, so the result matches sequential error diffusion inside each tile.
#include <xtree/color/space>

vec3 $source(vec2 cell) {
  vec3 c = xt_sample((cell + 0.5) * $pixelSize / xt_resolution).rgb;
  c = clamp(xt_linearToSrgb(max(c, 0.0)), 0.0, 1.0);
  if ($monochrome) c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)));
  return c;
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 cell = floor(uv * xt_resolution / $pixelSize);
  vec2 tile = floor(cell / 4.0) * 4.0;
  ivec2 local = ivec2(cell - tile);
  int target = local.y * 4 + local.x;
  float steps = max($levels - 1.0, 1.0);
  // Accumulated error for every pixel of the tile, filled in as the scan proceeds.
  vec3 error[16];
  for (int i = 0; i < 16; i++) error[i] = vec3(0.0);
  vec3 result = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i > target) break;
    int x = i % 4;
    int y = i / 4;
    vec3 value = $source(tile + vec2(x, y)) + error[i];
    vec3 quantized = clamp(floor(value * steps + 0.5) / steps, 0.0, 1.0);
    vec3 e = value - quantized;
    if (i == target) result = quantized;
#if $method == $method_atkinson
    // Atkinson: 1/8 to six neighbors, dropping a quarter of the error for more contrast.
    e /= 8.0;
    if (x < 3) error[i + 1] += e;
    if (x < 2) error[i + 2] += e;
    if (y < 3) {
      if (x > 0) error[i + 3] += e;
      error[i + 4] += e;
      if (x < 3) error[i + 5] += e;
    }
    if (y < 2) error[i + 8] += e;
#else
    // Floyd–Steinberg: 7/16 right, 3/16 down-left, 5/16 down, 1/16 down-right.
    if (x < 3) error[i + 1] += e * (7.0 / 16.0);
    if (y < 3) {
      if (x > 0) error[i + 3] += e * (3.0 / 16.0);
      error[i + 4] += e * (5.0 / 16.0);
      if (x < 3) error[i + 5] += e * (1.0 / 16.0);
    }
#endif
  }
  return vec4(xt_srgbToLinear(result), color.a);
}
