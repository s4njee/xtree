// Palette reduction: each pixel becomes the nearest color of a fixed palette, measured in OKLab, with optional ordered dithering. Palette colors are stored in linear sRGB.
#include <xtree/color/space>
#include <xtree/dither/ordered>

#if $palette == $palette_gameBoy
#define $COUNT 4
const vec3 $colors[4] = vec3[](
  vec3(0.00478, 0.03955, 0.00478),
  vec3(0.02956, 0.12214, 0.02956),
  vec3(0.25818, 0.41254, 0.00478),
  vec3(0.32778, 0.50289, 0.00478)
);
#elif $palette == $palette_cga
#define $COUNT 4
const vec3 $colors[4] = vec3[](
  vec3(0.00000, 0.00000, 0.00000),
  vec3(0.09084, 1.00000, 1.00000),
  vec3(1.00000, 0.09084, 1.00000),
  vec3(1.00000, 1.00000, 1.00000)
);
#elif $palette == $palette_ega
#define $COUNT 16
const vec3 $colors[16] = vec3[](
  vec3(0.00000, 0.00000, 0.00000),
  vec3(0.00000, 0.00000, 0.40198),
  vec3(0.00000, 0.40198, 0.00000),
  vec3(0.00000, 0.40198, 0.40198),
  vec3(0.40198, 0.00000, 0.00000),
  vec3(0.40198, 0.00000, 0.40198),
  vec3(0.40198, 0.09084, 0.00000),
  vec3(0.40198, 0.40198, 0.40198),
  vec3(0.09084, 0.09084, 0.09084),
  vec3(0.09084, 0.09084, 1.00000),
  vec3(0.09084, 1.00000, 0.09084),
  vec3(0.09084, 1.00000, 1.00000),
  vec3(1.00000, 0.09084, 0.09084),
  vec3(1.00000, 0.09084, 1.00000),
  vec3(1.00000, 1.00000, 0.09084),
  vec3(1.00000, 1.00000, 1.00000)
);
#elif $palette == $palette_pico8
#define $COUNT 16
const vec3 $colors[16] = vec3[](
  vec3(0.00000, 0.00000, 0.00000),
  vec3(0.01229, 0.02416, 0.08650),
  vec3(0.20864, 0.01850, 0.08650),
  vec3(0.00000, 0.24228, 0.08228),
  vec3(0.40724, 0.08438, 0.03689),
  vec3(0.11444, 0.09531, 0.07819),
  vec3(0.53948, 0.54572, 0.57112),
  vec3(1.00000, 0.87962, 0.80695),
  vec3(1.00000, 0.00000, 0.07421),
  vec3(1.00000, 0.36625, 0.00000),
  vec3(1.00000, 0.83880, 0.02029),
  vec3(0.00000, 0.77582, 0.03689),
  vec3(0.02217, 0.41789, 1.00000),
  vec3(0.22697, 0.18116, 0.33245),
  vec3(1.00000, 0.18447, 0.39157),
  vec3(1.00000, 0.60383, 0.40198)
);
#elif $palette == $palette_c64
#define $COUNT 16
const vec3 $colors[16] = vec3[](
  vec3(0.00000, 0.00000, 0.00000),
  vec3(1.00000, 1.00000, 1.00000),
  vec3(0.13843, 0.03820, 0.02416),
  vec3(0.16203, 0.37124, 0.44520),
  vec3(0.15896, 0.04667, 0.23840),
  vec3(0.09759, 0.26636, 0.05613),
  vec3(0.03560, 0.02122, 0.19120),
  vec3(0.47932, 0.57112, 0.15896),
  vec3(0.15896, 0.07819, 0.01850),
  vec3(0.05613, 0.04092, 0.00000),
  vec3(0.32314, 0.13563, 0.09990),
  vec3(0.05781, 0.05781, 0.05781),
  vec3(0.14996, 0.14996, 0.14996),
  vec3(0.32314, 0.64448, 0.23074),
  vec3(0.14996, 0.11193, 0.46208),
  vec3(0.30054, 0.30054, 0.30054)
);
#elif $palette == $palette_nes
#define $COUNT 55
const vec3 $colors[55] = vec3[](
  vec3(0.20156, 0.20156, 0.20156),
  vec3(0.00000, 0.00000, 0.97345),
  vec3(0.00000, 0.00000, 0.50289),
  vec3(0.05781, 0.02122, 0.50289),
  vec3(0.29614, 0.00000, 0.23074),
  vec3(0.39157, 0.00000, 0.01444),
  vec3(0.39157, 0.00518, 0.00000),
  vec3(0.24620, 0.00700, 0.00000),
  vec3(0.08022, 0.02956, 0.00000),
  vec3(0.00000, 0.18782, 0.00000),
  vec3(0.00000, 0.13843, 0.00000),
  vec3(0.00000, 0.09759, 0.00000),
  vec3(0.00000, 0.05127, 0.09759),
  vec3(0.00000, 0.00000, 0.00000),
  vec3(0.50289, 0.50289, 0.50289),
  vec3(0.00000, 0.18782, 0.93869),
  vec3(0.00000, 0.09759, 0.93869),
  vec3(0.13843, 0.05781, 0.97345),
  vec3(0.68669, 0.00000, 0.60383),
  vec3(0.77582, 0.00000, 0.09759),
  vec3(0.93869, 0.03955, 0.00000),
  vec3(0.77582, 0.10702, 0.00518),
  vec3(0.41254, 0.20156, 0.00000),
  vec3(0.00000, 0.47932, 0.00000),
  vec3(0.00000, 0.39157, 0.00000),
  vec3(0.00000, 0.39157, 0.05781),
  vec3(0.00000, 0.24620, 0.24620),
  vec3(0.93869, 0.93869, 0.93869),
  vec3(0.04519, 0.50289, 0.97345),
  vec3(0.13843, 0.24620, 0.97345),
  vec3(0.31399, 0.18782, 0.93869),
  vec3(0.93869, 0.18782, 0.93869),
  vec3(0.93869, 0.09759, 0.31399),
  vec3(0.93869, 0.18782, 0.09759),
  vec3(0.97345, 0.35153, 0.05781),
  vec3(0.93869, 0.47932, 0.00000),
  vec3(0.47932, 0.93869, 0.00913),
  vec3(0.09759, 0.68669, 0.08866),
  vec3(0.09759, 0.93869, 0.31399),
  vec3(0.00000, 0.80695, 0.68669),
  vec3(0.18782, 0.18782, 0.18782),
  vec3(0.97345, 0.97345, 0.97345),
  vec3(0.37124, 0.77582, 0.97345),
  vec3(0.47932, 0.47932, 0.93869),
  vec3(0.68669, 0.47932, 0.93869),
  vec3(0.93869, 0.47932, 0.93869),
  vec3(0.93869, 0.37124, 0.52712),
  vec3(0.87137, 0.63076, 0.43415),
  vec3(0.97345, 0.74540, 0.39157),
  vec3(0.93869, 0.68669, 0.18782),
  vec3(0.68669, 0.93869, 0.18782),
  vec3(0.47932, 0.93869, 0.47932),
  vec3(0.47932, 0.93869, 0.68669),
  vec3(0.00000, 0.97345, 0.97345),
  vec3(0.93869, 0.68669, 0.93869)
);
#else
#define $COUNT 4
#endif

vec3 $nearest(vec3 linearColor) {
#if $palette == $palette_custom
  vec3 colors[4] = vec3[]($color1, $color2, $color3, $color4);
#else
  vec3 colors[$COUNT] = $colors;
#endif
  vec3 lab = xt_linearToOklab(linearColor);
  vec3 best = colors[0];
  float bestDistance = 1e9;
  for (int i = 0; i < $COUNT; i++) {
    vec3 d = xt_linearToOklab(colors[i]) - lab;
    float distance = dot(d, d);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = colors[i];
    }
  }
  return best;
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 pixel = floor(uv * xt_resolution / $pixelSize);
  vec4 source = $pixelSize > 1.0 ? xt_sample((pixel + 0.5) * $pixelSize / xt_resolution) : color;
  vec3 c = clamp(xt_linearToSrgb(max(source.rgb, 0.0)), 0.0, 1.0);
  // Ordered dithering nudges each pixel before matching, so in-between shades become patterns.
  c += (xt_bayer(ivec2(pixel), 2) - 0.5) * $dither * 0.25;
  vec3 matched = $nearest(xt_srgbToLinear(clamp(c, 0.0, 1.0)));
  return vec4(mix(source.rgb, matched, $amount), source.a);
}
