// Volumetric fog: the scene seen through the marched fog, plus light scattered toward the camera in the fog color.
vec4 $main(vec4 color, vec2 uv) {
  vec4 fog = texture($fog, uv);
  return vec4(color.rgb * fog.a + fog.rgb * $color * $brightness, color.a);
}
