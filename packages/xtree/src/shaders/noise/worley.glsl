/**
 * Worley (cellular) noise (Worley, "A Cellular Texture Basis Function",
 * SIGGRAPH 1996). Returns the Euclidean distances to the nearest (F1) and
 * second-nearest (F2) feature points. Uses the standard 3x3 (3x3x3) cell
 * search: F1 is exact for jitter up to 1, and F2 can be slightly too large
 * at full jitter.
 */

#include <xtree/noise/hash>

/// 2D cellular noise. Returns vec2(F1, F2). `jitter` in [0, 1] moves feature points off the cell centers.
vec2 xt_worley(vec2 p, float jitter) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  float f1 = 1e9;
  float f2 = 1e9;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 o = ivec2(x, y);
      vec2 feature = 0.5 + (xt_latticeHash(ivec3(i + o, 0)).xy - 0.5) * jitter;
      vec2 r = vec2(o) + feature - f;
      float d = dot(r, r);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return sqrt(vec2(f1, f2));
}

/// 3D cellular noise. Returns vec2(F1, F2).
vec2 xt_worley(vec3 p, float jitter) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  float f1 = 1e9;
  float f2 = 1e9;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        ivec3 o = ivec3(x, y, z);
        vec3 feature = 0.5 + (xt_latticeHash(i + o) - 0.5) * jitter;
        vec3 r = vec3(o) + feature - f;
        float d = dot(r, r);
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) {
          f2 = d;
        }
      }
    }
  }
  return sqrt(vec2(f1, f2));
}
