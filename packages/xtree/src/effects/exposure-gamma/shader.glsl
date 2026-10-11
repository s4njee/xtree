// Exposure in stops, an offset and a gamma curve, in linear light.
vec4 $main(vec4 color, vec2 uv) {
  vec3 c = color.rgb * exp2($exposure) + $offset;
  c = pow(max(c, 0.0), vec3(1.0 / $gamma));
  return vec4(c, color.a);
}
