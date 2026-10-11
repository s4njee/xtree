// Wipes: a straight edge, a circle from a center, or a clock hand sweeping around it, with a soft edge that can glow in the theme accent.

// When this pixel changes, in [0, 1].
float $order(vec2 uv) {
  vec2 size = xt_size();
  vec2 aspect = vec2(size.x / size.y, 1.0);
  vec2 p = (uv - $center) * aspect;
  float v;
  if ($pattern == $pattern_radial) {
    // Normalized by the farthest corner, so the circle just covers the frame at 1.
    vec2 far = max($center, 1.0 - $center) * aspect;
    v = length(p) / length(far);
  } else if ($pattern == $pattern_clock) {
    float a = atan(p.x, p.y) - radians($angle);
    v = fract(a / 6.2831853 + 1.0);
  } else {
    float a = radians($angle);
    vec2 dir = vec2(cos(a), sin(a));
    vec2 q = (uv - 0.5) * aspect;
    float reach = abs(dir.x) * aspect.x * 0.5 + abs(dir.y) * 0.5;
    v = dot(q, dir) / (2.0 * reach) + 0.5;
  }
  v = clamp(v, 0.0, 1.0);
  return $reverse ? 1.0 - v : v;
}

vec4 $transition(vec2 uv, float progress) {
  vec4 from = xt_from(uv);
  vec4 to = xt_to(uv);
  float t = clamp((progress * (1.0 + $softness) - $order(uv)) / $softness, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec4 color = mix(from, to, t);
  // The glow is a thin line at the middle of the edge: a wide glowing band would flash every area it crosses (WCAG 2.3.1).
  color.rgb += xt_accent * pow(4.0 * t * (1.0 - t), 12.0) * $edgeGlow;
  return color;
}
