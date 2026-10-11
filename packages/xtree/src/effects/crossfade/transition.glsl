// Crossfade and luma wipe: each pixel switches when progress passes its pattern value, over a soft edge.
#include <xtree/noise/fbm>

// The pattern value in [0, 1]: when this pixel changes, as a fraction of the transition.
float $order(vec2 uv) {
  vec2 size = xt_size();
  vec2 p = (uv - 0.5) * vec2(size.x / size.y, 1.0);
  vec2 corner = vec2(0.5 * size.x / size.y, 0.5);
  float v;
#if $has_luma
  v = dot(texture($luma, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
#else
  if ($pattern == $pattern_noise) {
    v = clamp(xt_fbm(xt_seeded(uv * $scale, $seed), 4, 2.0, 0.5) * 0.6 + 0.5, 0.0, 1.0);
  } else if ($pattern == $pattern_linear) {
    float a = radians($angle);
    vec2 dir = vec2(cos(a), sin(a));
    // Normalize by the projected half-diagonal so the wipe spans the frame exactly.
    float reach = abs(dir.x) * corner.x + abs(dir.y) * corner.y;
    v = dot(p, dir) / (2.0 * reach) + 0.5;
  } else if ($pattern == $pattern_radial) {
    v = length(p) / length(corner);
  } else if ($pattern == $pattern_diamond) {
    v = (abs(p.x) + abs(p.y)) / (corner.x + corner.y);
  } else if ($pattern == $pattern_spiral) {
    float turn = atan(p.y, p.x) / 6.2831853 + 0.5;
    v = fract(turn + length(p) / length(corner) * $scale) * 0.999;
  } else {
    v = 0.0;
  }
#endif
  return $invert ? 1.0 - v : v;
}

vec4 $transition(vec2 uv, float progress) {
  vec4 from = xt_from(uv);
  vec4 to = xt_to(uv);
  if ($pattern == $pattern_fade && $has_luma == 0) return mix(from, to, progress);
  // Stretch progress by the softness so the edge starts before 0 and ends after 1.
  float t = clamp((progress * (1.0 + $softness) - $order(uv)) / $softness, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec4 color = mix(from, to, t);
  // The glow is a thin line at the middle of the edge: a wide glowing band would flash every area it crosses (WCAG 2.3.1).
  color.rgb += xt_accent * pow(4.0 * t * (1.0 - t), 12.0) * $edgeGlow;
  return color;
}
