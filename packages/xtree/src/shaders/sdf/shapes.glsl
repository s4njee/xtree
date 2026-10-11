/**
 * 2D signed distance functions and coordinate helpers (after Inigo Quilez's
 * distance function articles): negative inside, positive outside, in the
 * units of `p`.
 */

/// Distance to a circle of radius r at the origin.
float xt_sdCircle(vec2 p, float r) {
  return length(p) - r;
}

/// Distance to a box with half-size b at the origin.
float xt_sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

/// Distance to a box with half-size b and corner radius r.
float xt_sdRoundBox(vec2 p, vec2 b, float r) {
  return xt_sdBox(p, b - r) - r;
}

/// Distance to a regular hexagon with inner radius r (flat sides top and bottom).
float xt_sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

/// Distance to the segment from a to b.
float xt_sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

/// Smooth minimum of two distances over a blend width k (polynomial).
float xt_smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / max(k, 1e-6);
  return min(a, b) - h * h * k * 0.25;
}

/// Rotates p by angle a (radians, counter-clockwise).
vec2 xt_rotate(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c) * p;
}

/// Polar coordinates (radius, angle in radians from -π to π).
vec2 xt_toPolar(vec2 p) {
  return vec2(length(p), atan(p.y, p.x));
}

/// Log-polar coordinates (log radius, angle), for spirals and Droste-style zooms.
vec2 xt_toLogPolar(vec2 p) {
  return vec2(log(max(length(p), 1e-6)), atan(p.y, p.x));
}
