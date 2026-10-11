// Watercolor: wobbling, bleeding washes of simplified color, darker where pigment pools at the edges, granulating in the paper's grain.
#include <xtree/color/space>
#include <xtree/noise/value>
#include <xtree/sampling/spiral>

vec4 $main(vec4 color, vec2 uv) {
  vec2 p = uv * xt_resolution;
  // Wobble: hand-drawn wavering of every edge.
  vec2 wobble = (vec2(xt_valueNoise(p / 18.0), xt_valueNoise(p / 18.0 + 31.7)) - 0.5) * $wobble;
  vec2 st = uv + wobble / xt_resolution;
  // Bleed: a soft disk average of the color.
  vec3 wash = vec3(0.0);
  for (int i = 0; i < 16; i++) wash += min(xt_sample(st + xt_spiral(i, 16) * $bleed / xt_resolution).rgb, vec3(4.0));
  wash /= 16.0;
  vec3 c = clamp(xt_linearToSrgb(max(wash, 0.0)), 0.0, 1.0);
  vec3 sharp = clamp(xt_linearToSrgb(max(xt_sample(st).rgb, 0.0)), 0.0, 1.0);
  // Edge darkening: pigment collects where the wash changes.
  float pooling = clamp(length(sharp - c) * 3.0, 0.0, 1.0) * $edgeDarkening;
  // Pigment is subtractive: lighten toward paper, darken by multiplying.
  vec3 paper = xt_linearToSrgb($paper);
  vec3 pigment = mix(paper, c, 0.85) * (1.0 - pooling * 0.45);
  // Granulation: pigment settles in the dips of the paper.
  float grain = xt_valueNoise(p * 0.45) * 0.6 + xt_valueNoise(p * 1.7) * 0.4;
  pigment *= 1.0 - (grain - 0.5) * $granulation * 0.35;
  return vec4(xt_srgbToLinear(clamp(pigment, 0.0, 1.0)), color.a);
}
