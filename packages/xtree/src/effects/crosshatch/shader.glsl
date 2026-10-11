// Crosshatch: up to four layers of parallel lines at different angles, each switched on below a brightness threshold, on paper.
#include <xtree/color/space>

float $lines(vec2 p, float angle, float spacing) {
  vec2 d = vec2(cos(angle), sin(angle));
  float x = dot(p, vec2(-d.y, d.x)) / spacing;
  // Antialiased lines with a little width variation along their length.
  float width = 0.18 + 0.06 * sin(dot(p, d) * 0.05);
  float distance = abs(fract(x) - 0.5);
  return 1.0 - smoothstep(width * 0.5 - 0.08, width * 0.5 + 0.08, distance);
}

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = clamp(xt_linearToSrgb(max(color.rgb, 0.0)), 0.0, 1.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec2 p = uv * xt_resolution;
  float base = radians($angle);
  float ink = 0.0;
  for (int i = 0; i < 4; i++) {
    float threshold = 1.0 - (float(i) + 1.0) / 5.0 * (1.0 + $darkness);
    if (l < threshold) ink = max(ink, $lines(p, base + float(i) * 0.785398 * (i % 2 == 0 ? 1.0 : -1.0), $spacing));
  }
  vec3 paper = xt_linearToSrgb($paper);
  vec3 inkColor = $colored ? c * 0.35 : xt_linearToSrgb($ink);
  return vec4(xt_srgbToLinear(mix(paper, inkColor, ink)), color.a);
}
