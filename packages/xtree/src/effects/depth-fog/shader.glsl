// Depth fog: blends toward the fog color by view distance, attenuated with world height.
vec4 $main(vec4 color, vec2 uv) {
  bool sky = xt_depth(uv) >= 1.0;
  if (sky && !$background) return color;
  float d = max(xt_viewDepth(uv) - $start, 0.0);
  float fog;
  if ($mode == $mode_linear) {
    fog = clamp(d / max($end - $start, 1e-4), 0.0, 1.0);
  } else if ($mode == $mode_exponential) {
    fog = 1.0 - exp(-$density * d);
  } else {
    float x = $density * d;
    fog = 1.0 - exp(-x * x);
  }
  if ($heightFalloff > 0.0) {
    float above = xt_worldPosition(uv).y - $height;
    fog *= exp(-$heightFalloff * max(above, 0.0));
  }
  return vec4(mix(color.rgb, $color, fog * $maxOpacity), color.a);
}
