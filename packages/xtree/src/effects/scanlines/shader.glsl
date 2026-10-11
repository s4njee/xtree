// Scanlines: periodic darkened lines, optionally scrolling.
vec4 $main(vec4 color, vec2 uv) {
  float px = ($orientation == $orientation_horizontal ? uv.y * xt_resolution.y : uv.x * xt_resolution.x) + xt_time * $speed;
  float phase = fract(px / $lineWidth);
  float hard = step(0.5, phase);
  float soft = 0.5 - 0.5 * cos(phase * 6.28318530718);
  float dark = mix(hard, soft, $softness);
  return vec4(color.rgb * (1.0 - $intensity * dark), color.a);
}
