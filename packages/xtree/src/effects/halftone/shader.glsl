// Halftone: each screen is a rotated grid; an element's size follows the tone sampled at its cell center.
#include <xtree/color/space>

// Ink coverage of one screen element for a pixel at `px` (centered pixels).
// `channel` picks the tone from the sampled color: 0–2 are RGB, 3 is CMYK key,
// 4–6 are cyan, magenta and yellow, 7 is luminance (mono).
float $screen(vec2 px, float angle, int channel) {
  float c = cos(angle), s = sin(angle);
  mat2 rotation = mat2(c, s, -s, c);
  vec2 q = transpose(rotation) * px / $scale;
  vec2 cell = floor(q) + 0.5;
  vec2 local = q - cell;
  vec2 center = rotation * cell * $scale + 0.5 * xt_resolution;
  vec3 rgb = clamp(xt_linearToSrgb(max(xt_sample(clamp(center * xt_texel, 0.0, 1.0)).rgb, 0.0)), 0.0, 1.0);
  float k = 1.0 - max(rgb.r, max(rgb.g, rgb.b));
  vec3 cmy = (1.0 - rgb - k) / max(1.0 - k, 1e-4);
  float tone;
  if (channel < 3) tone = rgb[channel];
  else if (channel == 3) tone = k;
  else if (channel < 7) tone = cmy[channel - 4];
  else tone = 1.0 - dot(rgb, vec3(0.2126, 0.7152, 0.0722));

  float aa = 0.5 * $softness / $scale;
  float d, edge;
  if ($shape == $shape_line) {
    d = abs(local.y);
    edge = 0.5 * tone;
  } else if ($shape == $shape_square) {
    d = max(abs(local.x), abs(local.y));
    edge = 0.5 * sqrt(tone);
  } else {
    // Area-true up to touching circles (r = 0.5), then grows to cover the corners.
    d = length(local);
    edge = tone < 0.7853982 ? sqrt(tone / 3.1415927) : mix(0.5, 0.7072, (tone - 0.7853982) / 0.2146018);
  }
  return tone <= 0.0 ? 0.0 : 1.0 - smoothstep(edge - aa, edge + aa, d);
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 px = uv * xt_resolution - 0.5 * xt_resolution;
  float base = radians($angle);
  vec3 result;
  if ($mode == $mode_mono) {
    float ink = $screen(px, base + radians(45.0), 7);
    result = mix(xt_linearToSrgb($paper), xt_linearToSrgb($ink), ink);
  } else if ($mode == $mode_rgb) {
    result = vec3(
      $screen(px, base + radians(15.0), 0),
      $screen(px, base + radians(75.0), 1),
      $screen(px, base, 2)
    );
  } else {
    vec3 paper = xt_linearToSrgb($paper);
    float cyan = $screen(px, base + radians(15.0), 4);
    float magenta = $screen(px, base + radians(75.0), 5);
    float yellow = $screen(px, base, 6);
    float key = $screen(px, base + radians(45.0), 3);
    result = paper * (1.0 - vec3(cyan, magenta, yellow)) * (1.0 - key);
  }
  return vec4(xt_srgbToLinear(result), color.a);
}
