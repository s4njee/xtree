// 2D bokeh: a golden-angle spiral of samples over a disk or hexagon, with bright samples weighted up so highlights become shapes.
#include <xtree/sampling/spiral>

// Scales a point in the unit disk to the hexagon of the same circumradius.
vec2 $hexagon(vec2 p) {
  float angle = atan(p.y, p.x);
  float sector = 3.14159265 / 3.0;
  float local = mod(angle + sector * 0.5, sector) - sector * 0.5;
  return p * cos(sector * 0.5) / cos(local);
}

vec4 $main(vec4 color, vec2 uv) {
  vec4 sum = vec4(0.0);
  float weight = 0.0;
  for (int i = 0; i < 128; i++) {
    if (i >= $samples) break;
    vec2 p = xt_spiral(i, $samples);
#if $shape == $shape_hexagon
    p = $hexagon(p);
#endif
    vec4 c = xt_sample(uv + p * $radius / xt_resolution);
    float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    float w = 1.0 + $highlights * max(luma - 1.0, 0.0) + $highlights * 0.5 * luma;
    sum += c * w;
    weight += w;
  }
  return sum / weight;
}
