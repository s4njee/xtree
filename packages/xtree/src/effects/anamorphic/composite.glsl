// Anamorphic streaks composite: adds the stretched highlights in the streak color.
vec4 $main(vec4 color, vec2 uv) {
  return vec4(color.rgb + texture($streaks, uv).rgb * $intensity * $tint, color.a);
}
