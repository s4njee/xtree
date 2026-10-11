// Lens distortion: the Brown–Conrady radial model (k1, k2), normalized so the corners have radius 1.
vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * aspect / $scale;
  float r2 = dot(p, p) / dot(0.5 * aspect, 0.5 * aspect);
  vec2 st = p * (1.0 + $k1 * r2 + $k2 * r2 * r2) / aspect + 0.5;
  if ($edges == $edges_black) {
    if (any(lessThan(st, vec2(0.0))) || any(greaterThan(st, vec2(1.0)))) return vec4(0.0, 0.0, 0.0, color.a);
  } else if ($edges == $edges_mirror) {
    st = 1.0 - abs(1.0 - abs(st));
  } else {
    st = clamp(st, 0.0, 1.0);
  }
  return xt_sample(st);
}
