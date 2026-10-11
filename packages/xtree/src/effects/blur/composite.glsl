// Blur composite: replaces the image with the blurred copy.
vec4 $main(vec4 color, vec2 uv) {
  return vec4(texture($blurred, uv).rgb, color.a);
}
