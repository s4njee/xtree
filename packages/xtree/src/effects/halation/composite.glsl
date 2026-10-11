// Halation: light that passed through the film bounced off its backing and re-exposed the red layer, glowing red-orange around highlights.
vec4 $main(vec4 color, vec2 uv) {
  vec3 glow = texture($bloom, uv).rgb;
  float energy = dot(glow, vec3(0.2126, 0.7152, 0.0722));
  return vec4(color.rgb + energy * $tint * $intensity, color.a);
}
