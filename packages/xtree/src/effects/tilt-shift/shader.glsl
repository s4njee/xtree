// Tilt-shift: a disc blur whose radius grows away from a focus band.
vec4 $main(vec4 color, vec2 uv) {
  float a = radians($angle);
  vec2 normal = vec2(-sin(a), cos(a));
  float distance = abs(dot(uv - 0.5, normal) - ($focus - 0.5));
  float amount = smoothstep($width * 0.5, $width * 0.5 + $feather, distance);
  float radius = amount * $blur;
  if (radius < 0.5) return color;
  // Golden-angle (Vogel) disc sampling.
  vec3 sum = vec3(0.0);
  for (int i = 0; i < $samples; i++) {
    float r = sqrt((float(i) + 0.5) / float($samples)) * radius;
    float theta = float(i) * 2.39996323;
    sum += xt_sample(uv + vec2(cos(theta), sin(theta)) * r * xt_texel).rgb;
  }
  return vec4(sum / float($samples), color.a);
}
