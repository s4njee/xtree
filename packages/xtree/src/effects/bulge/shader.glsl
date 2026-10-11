// Bulge and pinch: a lens over a circle that magnifies (bulge) or shrinks (pinch) toward its center.
vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  vec2 d = (uv - $center) * aspect;
  float r = length(d) / $radius;
  if (r >= 1.0 || r <= 0.0) return color;
  // Positive strength samples closer to the center (magnifying), negative farther (shrinking).
  float k = $strength >= 0.0 ? mix(1.0, smoothstep(0.0, 1.0, r), $strength) : mix(1.0, 2.0 - smoothstep(0.0, 1.0, r), -$strength);
  float scale = mix(k, 1.0, smoothstep(0.7, 1.0, r));
  return xt_sample($center + d * scale / aspect);
}
