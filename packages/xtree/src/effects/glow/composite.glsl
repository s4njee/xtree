// Glow composite: adds the blurred source in the halo color, outside the selection for the outer mode.
vec4 $main(vec4 color, vec2 uv) {
  float halo = texture($glow, uv).r;
  if ($mode == $mode_outer) halo *= 1.0 - $maskAt(uv) * float($has_mask);
  return vec4(color.rgb + $color * halo * $intensity, color.a);
}
