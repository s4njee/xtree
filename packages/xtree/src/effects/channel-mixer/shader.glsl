// Channel mixer: each output channel is a weighted sum of the input channels, in linear light.
vec4 $main(vec4 color, vec2 uv) {
  vec3 c = max(color.rgb, 0.0);
  vec3 mixed = vec3(dot(c, $red), dot(c, $green), dot(c, $blue));
  if ($monochrome) mixed = vec3(dot(c, $red));
  if ($preserveLuminance) {
    float before = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float after = dot(mixed, vec3(0.2126, 0.7152, 0.0722));
    mixed *= before / max(after, 1e-4);
  }
  return vec4(max(mix(c, mixed, $amount), 0.0), color.a);
}
