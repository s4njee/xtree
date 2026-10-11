/**
 * Ordered dithering and quantization: Bayer threshold matrices of any power
 * of two (Bayer, "An optimum method for two-level rendition of
 * continuous-tone pictures", 1973) and level quantization against a
 * threshold.
 */

/// Bayer threshold in (0, 1) for a pixel of a 2^n × 2^n matrix (n = 1 for 2×2, 2 for 4×4, 3 for 8×8).
float xt_bayer(ivec2 p, int n) {
  int value = 0;
  for (int i = 0; i < n; i++) {
    int x = (p.x >> i) & 1;
    int y = (p.y >> i) & 1;
    value |= (((x ^ y) << 1) | y) << (2 * (n - 1 - i));
  }
  return (float(value) + 0.5) / float(1 << (2 * n));
}

/// Quantizes each channel to `levels` steps (at least 2), rounding by a threshold in (0, 1); 0.5 rounds to nearest.
vec3 xt_quantize(vec3 c, float levels, float threshold) {
  float steps = max(levels - 1.0, 1.0);
  return clamp(floor(c * steps + threshold) / steps, 0.0, 1.0);
}
