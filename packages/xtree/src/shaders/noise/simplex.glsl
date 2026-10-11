/**
 * Simplex noise in 2, 3 and 4 dimensions (Perlin 2001; corner ordering as
 * described by Gustavson, "Simplex noise demystified", 2005). Gradients are
 * hashed unit vectors and the kernel radius squared is 0.5, so the noise is
 * continuous. Output is in [-1, 1]; the scale factors come from the
 * analytic bound of each kernel sum.
 */

#include <xtree/noise/gradient>

/// 2D simplex noise in [-1, 1].
float xt_simplex(vec2 p) {
  const float F2 = 0.366025403784; // (sqrt(3) - 1) / 2
  const float G2 = 0.211324865405; // (3 - sqrt(3)) / 6
  vec2 s = floor(p + (p.x + p.y) * F2);
  vec2 x0 = p - s + (s.x + s.y) * G2;
  vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 x1 = x0 - i1 + G2;
  vec2 x2 = x0 - 1.0 + 2.0 * G2;
  ivec2 c = ivec2(s);
  vec3 t = max(0.5 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  t *= t;
  t *= t;
  vec3 n = vec3(
    dot(xt_gradient2(c), x0),
    dot(xt_gradient2(c + ivec2(i1)), x1),
    dot(xt_gradient2(c + ivec2(1)), x2)
  );
  return 99.2 * dot(t, n);
}

/// 3D simplex noise in [-1, 1].
float xt_simplex(vec3 p) {
  const float F3 = 0.333333333333;
  const float G3 = 0.166666666667;
  vec3 s = floor(p + dot(p, vec3(F3)));
  vec3 x0 = p - s + dot(s, vec3(G3));
  vec3 i1;
  vec3 i2;
  if (x0.x >= x0.y) {
    if (x0.y >= x0.z) {
      i1 = vec3(1.0, 0.0, 0.0);
      i2 = vec3(1.0, 1.0, 0.0);
    } else if (x0.x >= x0.z) {
      i1 = vec3(1.0, 0.0, 0.0);
      i2 = vec3(1.0, 0.0, 1.0);
    } else {
      i1 = vec3(0.0, 0.0, 1.0);
      i2 = vec3(1.0, 0.0, 1.0);
    }
  } else {
    if (x0.y < x0.z) {
      i1 = vec3(0.0, 0.0, 1.0);
      i2 = vec3(0.0, 1.0, 1.0);
    } else if (x0.x < x0.z) {
      i1 = vec3(0.0, 1.0, 0.0);
      i2 = vec3(0.0, 1.0, 1.0);
    } else {
      i1 = vec3(0.0, 1.0, 0.0);
      i2 = vec3(1.0, 1.0, 0.0);
    }
  }
  vec3 x1 = x0 - i1 + G3;
  vec3 x2 = x0 - i2 + 2.0 * G3;
  vec3 x3 = x0 - 1.0 + 3.0 * G3;
  ivec3 c = ivec3(s);
  vec4 t = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  t *= t;
  t *= t;
  vec4 n = vec4(
    dot(xt_gradient3(c), x0),
    dot(xt_gradient3(c + ivec3(i1)), x1),
    dot(xt_gradient3(c + ivec3(i2)), x2),
    dot(xt_gradient3(c + ivec3(1)), x3)
  );
  return 107.6 * dot(t, n);
}

/// 4D simplex noise in [-1, 1]. Use the fourth axis for looping or evolving 3D noise.
float xt_simplex(vec4 p) {
  const float F4 = 0.309016994375; // (sqrt(5) - 1) / 4
  const float G4 = 0.138196601125; // (5 - sqrt(5)) / 20
  vec4 s = floor(p + dot(p, vec4(F4)));
  vec4 x0 = p - s + dot(s, vec4(G4));
  // Rank each axis; the simplex corners step along axes from largest to smallest.
  vec4 rank = vec4(0.0);
  if (x0.x > x0.y) rank.x += 1.0; else rank.y += 1.0;
  if (x0.x > x0.z) rank.x += 1.0; else rank.z += 1.0;
  if (x0.x > x0.w) rank.x += 1.0; else rank.w += 1.0;
  if (x0.y > x0.z) rank.y += 1.0; else rank.z += 1.0;
  if (x0.y > x0.w) rank.y += 1.0; else rank.w += 1.0;
  if (x0.z > x0.w) rank.z += 1.0; else rank.w += 1.0;
  vec4 i1 = step(2.5, rank);
  vec4 i2 = step(1.5, rank);
  vec4 i3 = step(0.5, rank);
  vec4 x1 = x0 - i1 + G4;
  vec4 x2 = x0 - i2 + 2.0 * G4;
  vec4 x3 = x0 - i3 + 3.0 * G4;
  vec4 x4 = x0 - 1.0 + 4.0 * G4;
  ivec4 c = ivec4(s);
  vec4 t = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  float t4 = max(0.5 - dot(x4, x4), 0.0);
  t *= t;
  t *= t;
  t4 *= t4;
  t4 *= t4;
  vec4 n = vec4(
    dot(xt_gradient4(c), x0),
    dot(xt_gradient4(c + ivec4(i1)), x1),
    dot(xt_gradient4(c + ivec4(i2)), x2),
    dot(xt_gradient4(c + ivec4(i3)), x3)
  );
  return 108.5 * (dot(t, n) + t4 * dot(xt_gradient4(c + ivec4(1)), x4));
}
