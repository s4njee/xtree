/**
 * Fractal Brownian motion: octaves of simplex noise, each scaled by
 * `lacunarity` in frequency and `gain` in amplitude. The result is divided by
 * the total amplitude, so it stays in [-1, 1]. Each octave is offset to
 * avoid artifacts aligned at the origin.
 */

#include <xtree/noise/simplex>

/// 2D fBm of simplex noise in [-1, 1]. Typical values: octaves 5, lacunarity 2.0, gain 0.5.
float xt_fbm(vec2 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    sum += amplitude * xt_simplex(p);
    total += amplitude;
    p = p * lacunarity + vec2(17.31, -9.43);
    amplitude *= gain;
  }
  return total > 0.0 ? sum / total : 0.0;
}

/// 3D fBm of simplex noise in [-1, 1].
float xt_fbm(vec3 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < octaves; i++) {
    sum += amplitude * xt_simplex(p);
    total += amplitude;
    p = p * lacunarity + vec3(17.31, -9.43, 5.27);
    amplitude *= gain;
  }
  return total > 0.0 ? sum / total : 0.0;
}
