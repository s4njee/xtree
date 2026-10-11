// ASCII: averages each cell, picks a glyph by brightness and draws it from the font strip.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  const vec2 tile = vec2(6.0, 8.0);
  vec2 cellSize = $cellSize * vec2(1.0, tile.y / tile.x);
  vec2 px = uv * xt_resolution;
  vec2 cell = floor(px / cellSize);
  vec2 local = (px - cell * cellSize) / cellSize;

  // Average four samples so thin details still register.
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 offset = vec2(i & 1, i >> 1) * 0.5 + 0.25;
    sum += max(xt_sample(clamp((cell + offset) * cellSize * xt_texel, 0.0, 1.0)).rgb, 0.0);
  }
  vec3 average = sum * 0.25;
  vec3 encoded = clamp(xt_linearToSrgb(average) * $brightness, 0.0, 1.0);
  float level = dot(encoded, vec3(0.2126, 0.7152, 0.0722));
  if ($invert) level = 1.0 - level;

  // Glyph texel inside the tile; tile rows count from the bottom.
  ivec2 texel = ivec2(floor(local * tile));
  float ink;
  if ($charset == $charset_blocks) {
    // Five shades: empty, quarter, half, three-quarter and full, from 2×2 texel patterns.
    int shade = int(min(floor(level * 5.0), 4.0));
    int bayer = ((texel.x & 1) ^ (texel.y & 1)) * 2 + (texel.y & 1);
    ink = float(bayer < shade);
  } else {
#if $has_font
    int count = textureSize($font, 0).x / int(tile.x);
    if ($charset == $charset_classic) count = min(count, 10);
    int glyph = int(min(floor(level * float(count)), float(count - 1)));
    // Binary leaves dark cells blank, then uses "1" before the inkier "0".
    if ($charset == $charset_binary) glyph = level < 0.2 ? 0 : (level < 0.6 ? 11 : 10);
    ink = texelFetch($font, ivec2(glyph * int(tile.x), 0) + texel, 0).r;
#else
    ink = step(0.5, level);
#endif
  }

  vec3 foreground = $colorMode == $colorMode_mono ? $foreground : average;
  return vec4(mix($background, foreground, ink), color.a);
}
