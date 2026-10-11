// Kaleidoscope: folds the frame into mirrored wedges around a center.
vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  vec2 d = (uv - $center) * aspect;
  float r = length(d);
  float wedge = 6.2831853 / $segments;
  float a = atan(d.y, d.x) - radians($rotation);
  a = mod(a, wedge);
  // Mirror every other wedge so the edges meet.
  a = abs(a - wedge * 0.5);
  a += radians($rotation) + radians($offset);
  vec2 st = $center + vec2(cos(a), sin(a)) * r * $zoom / aspect;
  // Reflect outside the frame instead of clamping.
  st = 1.0 - abs(1.0 - mod(st, 2.0));
  return xt_sample(st);
}
