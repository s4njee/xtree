// Star filter composite: adds the star lines over the image.
vec4 $main(vec4 color, vec2 uv) {
  return vec4(color.rgb + texture($star, uv).rgb * $intensity, color.a);
}
