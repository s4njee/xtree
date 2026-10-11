// Vignette: darkens (or tints) the frame toward its edges.
vec4 $main(vec4 color, vec2 uv) {
  vec2 p = uv - 0.5;
  float falloff;
  if ($mode == $mode_eskil) {
    // Eskil's vignette, as in three.js's VignetteShader: quadratic in the scaled radius.
    vec2 q = p * (2.0 * $offset);
    falloff = clamp(dot(q, q), 0.0, 1.0);
  } else {
    float aspect = xt_resolution.x / xt_resolution.y;
    // Roundness 1 is a circle on screen; 0 follows the frame's aspect ratio.
    p.x *= mix(1.0, aspect, $roundness);
    float d = length(p) * 2.0;
    falloff = smoothstep($offset, $offset + $smoothness, d);
  }
  return vec4(mix(color.rgb, $color, falloff * $darkness), color.a);
}
