// Bloom composite: adds the blurred highlights to the scene.
vec4 $main(vec4 color, vec2 uv) {
  return vec4(color.rgb + texture($bloom, uv).rgb * $intensity * $tint, color.a);
}
