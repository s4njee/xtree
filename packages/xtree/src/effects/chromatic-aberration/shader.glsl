// Chromatic aberration: samples color channels (or a spectrum) at offset positions.
// Triangle weights from red (t = 0) through green to blue (t = 1).
vec3 $spectrum(float t) {
  return vec3(max(0.0, 1.0 - 2.0 * t), 1.0 - abs(2.0 * t - 1.0), max(0.0, 2.0 * t - 1.0));
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  vec2 shift;
  if ($mode == $mode_radial) {
    vec2 v = (uv - $center) * aspect;
    float r = length(v) / length(0.5 * aspect);
    shift = r > 0.0 ? v / length(v) * pow(r, $falloff) : vec2(0.0);
  } else {
    float len = length($direction);
    shift = len > 0.0 ? $direction / len : vec2(0.0);
  }
  vec2 d = shift / aspect * $offset;
#if $samples <= 3
  return vec4(xt_sample(uv + d).r, color.g, xt_sample(uv - d).b, color.a);
#else
  vec3 sum = vec3(0.0);
  vec3 weight = vec3(0.0);
  for (int i = 0; i < $samples; i++) {
    float t = float(i) / float($samples - 1);
    vec3 w = $spectrum(t);
    sum += xt_sample(uv + d * (1.0 - 2.0 * t)).rgb * w;
    weight += w;
  }
  return vec4(sum / weight, color.a);
#endif
}
