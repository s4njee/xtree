// Datamosh composite: the moshed frame.
vec4 $main(vec4 color, vec2 uv) {
  return vec4(mix(color.rgb, texture($moshed, uv).rgb, $amount), color.a);
}
