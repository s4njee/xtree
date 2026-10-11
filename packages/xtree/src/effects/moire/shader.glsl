// Moiré: two fine line (or ring) gratings, slightly rotated or scaled against each other, whose interference makes large shimmering bands.
float $grating(vec2 p, float angle, float frequency) {
#if $pattern == $pattern_rings
  return 0.5 + 0.5 * cos(length(p) * frequency * 6.2831853);
#else
  vec2 d = vec2(cos(angle), sin(angle));
  return 0.5 + 0.5 * cos(dot(p, d) * frequency * 6.2831853);
#endif
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(xt_resolution.x / xt_resolution.y, 1.0);
  float drift = xt_time * $speed;
  float a = radians($angle);
  float layer1 = $grating(p, a, $frequency);
  float layer2 = $grating(p + vec2($offset + drift * 0.01, 0.0), a + radians($twist), $frequency * (1.0 + $scale));
  float pattern = layer1 * layer2;
  vec3 tint = mix(vec3(1.0), 0.5 + 0.5 * cos(6.2831853 * (pattern + vec3(0.0, 0.33, 0.67))), $iridescence);
  vec3 lit = color.rgb * mix(1.0, pattern * 2.0, $amount) * mix(vec3(1.0), tint, $amount);
  return vec4(lit, color.a);
}
