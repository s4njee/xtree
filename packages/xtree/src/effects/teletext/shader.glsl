// Teletext: a coarse grid of character cells, each drawing 2×3 block mosaics in two of eight broadcast colors (or 1-bit white on black).
#include <xtree/color/space>

// The nearest of the eight teletext colors: each channel fully on or off.
vec3 $nearestTeletext(vec3 c) {
  return step(vec3(0.5), c);
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 cellSize = xt_resolution / vec2($columns, $rows);
  vec2 cell = floor(uv * xt_resolution / cellSize);
  vec2 local = fract(uv * xt_resolution / cellSize);
  // The six sixels of the cell, 2 across and 3 down, each averaged from the image.
  vec3 sixels[6];
  float brightest = -1.0;
  float darkest = 2.0;
  vec3 light = vec3(1.0);
  vec3 dark = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    vec2 sub = vec2(float(i % 2), float(i / 2));
    vec2 center = (cell + (sub + 0.5) / vec2(2.0, 3.0)) * cellSize / xt_resolution;
    vec3 c = clamp(xt_linearToSrgb(max(xt_sample(center).rgb, 0.0)), 0.0, 1.0);
    sixels[i] = c;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    if (l > brightest) { brightest = l; light = c; }
    if (l < darkest) { darkest = l; dark = c; }
  }
  vec3 foreground = $mono ? vec3(1.0) : $nearestTeletext(light);
  vec3 background = $mono ? vec3(0.0) : $nearestTeletext(dark * 0.6);
  if (foreground == background) background = vec3(0.0);
  int index = int(min(floor(local.x * 2.0), 1.0)) + 2 * int(min(floor((1.0 - local.y) * 3.0), 2.0));
  float l = dot(sixels[index], vec3(0.2126, 0.7152, 0.0722));
  bool on = l > mix(darkest, brightest, 0.5) && brightest - darkest > 0.04 || darkest > 0.6;
  if ($mono) on = l > $threshold;
  // Thin gaps between sixels, as on a teletext screen.
  vec2 sixel = fract(local * vec2(2.0, 3.0));
  float gap = $separated ? step(0.12, sixel.x) * step(0.12, sixel.y) : 1.0;
  vec3 c = on ? foreground * gap : background;
  return vec4(xt_srgbToLinear(c), color.a);
}
