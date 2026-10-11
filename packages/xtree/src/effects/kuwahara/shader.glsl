// Kuwahara: each pixel takes the mean of whichever neighboring region varies least, which flattens texture into painterly strokes while keeping edges. Four square quadrants (classic), or eight soft sectors (Papari's generalized filter).
vec4 $main(vec4 color, vec2 uv) {
  int r = int($radius);
#if $sectors == $sectors_four
  vec3 mean[4];
  vec3 sq[4];
  float n[4];
  for (int k = 0; k < 4; k++) { mean[k] = vec3(0.0); sq[k] = vec3(0.0); n[k] = 0.0; }
  for (int j = -8; j <= 8; j++) {
    if (abs(j) > r) continue;
    for (int i = -8; i <= 8; i++) {
      if (abs(i) > r) continue;
      vec3 c = min(xt_sample(uv + vec2(float(i), float(j)) * xt_texel).rgb, vec3(16.0));
      if (i <= 0 && j <= 0) { mean[0] += c; sq[0] += c * c; n[0] += 1.0; }
      if (i >= 0 && j <= 0) { mean[1] += c; sq[1] += c * c; n[1] += 1.0; }
      if (i <= 0 && j >= 0) { mean[2] += c; sq[2] += c * c; n[2] += 1.0; }
      if (i >= 0 && j >= 0) { mean[3] += c; sq[3] += c * c; n[3] += 1.0; }
    }
  }
  float best = 1e9;
  vec3 result = color.rgb;
  for (int k = 0; k < 4; k++) {
    vec3 m = mean[k] / n[k];
    vec3 v = sq[k] / n[k] - m * m;
    float variance = v.r + v.g + v.b;
    if (variance < best) { best = variance; result = m; }
  }
  return vec4(result, color.a);
#else
  vec3 mean[8];
  vec3 sq[8];
  float w[8];
  for (int k = 0; k < 8; k++) { mean[k] = vec3(0.0); sq[k] = vec3(0.0); w[k] = 0.0; }
  for (int j = -8; j <= 8; j++) {
    if (abs(j) > r) continue;
    for (int i = -8; i <= 8; i++) {
      if (abs(i) > r) continue;
      vec2 o = vec2(float(i), float(j));
      float d = length(o) / float(max(r, 1));
      if (d > 1.0) continue;
      vec3 c = min(xt_sample(uv + o * xt_texel).rgb, vec3(16.0));
      float angle = atan(o.y, o.x);
      for (int k = 0; k < 8; k++) {
        // Smooth, overlapping sector weights.
        float a = angle - float(k) * 0.78539816;
        a = mod(a + 3.14159265, 6.2831853) - 3.14159265;
        float sector = (i == 0 && j == 0) ? 0.125 : max(0.0, cos(a * 2.0)) * max(0.0, cos(a * 2.0));
        float weight = sector * exp(-d * d * 2.0);
        mean[k] += c * weight;
        sq[k] += c * c * weight;
        w[k] += weight;
      }
    }
  }
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int k = 0; k < 8; k++) {
    vec3 m = mean[k] / max(w[k], 1e-5);
    vec3 v = abs(sq[k] / max(w[k], 1e-5) - m * m);
    // Low-variance sectors dominate (Papari et al., q = 8).
    float weight = 1.0 / (1.0 + pow(1000.0 * (v.r + v.g + v.b), 4.0));
    sum += m * weight;
    total += weight;
  }
  return vec4(sum / max(total, 1e-5), color.a);
#endif
}
