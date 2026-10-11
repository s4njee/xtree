// Wave warp: sine displacement across one or both axes, travelling over time.
vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  float t = xt_time * $speed * 6.2831853;
  vec2 p = uv * aspect;
  vec2 offset = vec2(0.0);
  if ($axis != $axis_vertical) offset.x = sin(p.y * $frequency * 6.2831853 + t);
  if ($axis != $axis_horizontal) offset.y = sin(p.x * $frequency * 6.2831853 + t * 0.9 + 1.3);
  return xt_sample(uv + offset * $amplitude / xt_resolution);
}
