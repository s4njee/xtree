// CRT: curved glass, phosphor mask, scanlines, glow, vignette and a small flicker.
#include <xtree/noise/hash>

vec2 $curve(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  p *= 1.0 + $curvature * (p.yx * p.yx);
  return p * 0.5 + 0.5;
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 st = $curve(uv);
  if (any(lessThan(st, vec2(0.0))) || any(greaterThan(st, vec2(1.0)))) return vec4(0.0, 0.0, 0.0, color.a);
  vec2 shift = vec2($chromatic, 0.0);
  vec3 c = vec3(xt_sample(st + shift).r, xt_sample(st).g, xt_sample(st - shift).b);
  // Cheap phosphor glow: four diagonal taps two pixels out.
  vec2 o = 2.0 * xt_texel;
  vec3 halo = (xt_sample(st + o).rgb + xt_sample(st - o).rgb + xt_sample(st + vec2(o.x, -o.y)).rgb + xt_sample(st + vec2(-o.x, o.y)).rgb) * 0.25;
  c += halo * $glow;
  // Scanlines follow the curved raster.
  float phase = fract(st.y * xt_resolution.y / $lineWidth);
  c *= 1.0 - $scanlines * (0.5 - 0.5 * cos(phase * 6.28318530718));
  // Phosphor mask in screen pixels.
  if ($phosphor != $phosphor_none) {
    vec2 px = uv * xt_resolution / $maskScale;
    int column = int(mod(px.x, 3.0));
    if ($phosphor == $phosphor_slot) column = int(mod(px.x + (mod(floor(px.y / 2.0), 2.0) * 1.5), 3.0));
    if ($phosphor == $phosphor_shadow) column = int(mod(px.x + floor(px.y) * 1.5, 3.0));
    vec3 phosphor = vec3(column == 0 ? 1.0 : 0.0, column == 1 ? 1.0 : 0.0, column == 2 ? 1.0 : 0.0);
    c *= mix(vec3(1.0), phosphor * 1.5 + 0.25, $maskStrength);
  }
  vec2 edge = st * (1.0 - st);
  c *= mix(1.0, clamp(pow(edge.x * edge.y * 16.0, 0.35), 0.0, 1.0), $vignette);
  c *= 1.0 + $flicker * (xt_hash1(xt_seeded(vec2(floor(xt_time * 30.0), 3.0), $seed)) - 0.5);
  return vec4(c * $brightness, color.a);
}
