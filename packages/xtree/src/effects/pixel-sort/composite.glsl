// Pixel sort composite: the sorted image, mixed with the original.
vec4 $main(vec4 color, vec2 uv) {
  return vec4(mix(color.rgb, texture($sorted, uv).rgb, $amount), color.a);
}
