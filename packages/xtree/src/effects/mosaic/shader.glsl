// Stained glass: a jittered Voronoi tiling, each cell filled with the image color at its site and outlined in lead.
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  vec2 p = uv * xt_resolution / $cellSize;
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float nearest = 8.0;
  float second = 8.0;
  vec2 site = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 neighbor = vec2(float(i), float(j));
      vec2 point = neighbor + 0.5 + (xt_hash2(cell + neighbor + float($seed)) - 0.5) * $jitter;
      float d = length(point - local);
      if (d < nearest) {
        second = nearest;
        nearest = d;
        site = cell + point;
      } else if (d < second) {
        second = d;
      }
    }
  }
  vec3 fill = xt_sample(site * $cellSize / xt_resolution).rgb * $glow;
  // Lead lines where the two nearest sites are almost equally close.
  float edge = 1.0 - smoothstep($lineWidth * 0.5, $lineWidth * 0.5 + 0.03, second - nearest);
  return vec4(mix(fill, $lead, edge), color.a);
}
