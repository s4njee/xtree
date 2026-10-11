// Wobble: vertices pushed along their normals by drifting noise. The normal is recomputed from the displaced surface (by displacing two nearby points on the tangent plane) so the lighting follows the new shape.
#include <xtree/noise/simplex>

float $offset(vec3 p) {
  return xt_simplex(vec4(p * $frequency, $time * $speed)) * $amplitude;
}

void $vertex(inout vec3 position, inout vec3 normal) {
  vec3 n = normalize(normal);
  vec3 helper = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t = normalize(cross(helper, n));
  vec3 b = cross(n, t);
  float e = 0.01;
  vec3 p0 = position + n * $offset(position);
  vec3 p1 = position + t * e;
  p1 += n * $offset(p1);
  vec3 p2 = position + b * e;
  p2 += n * $offset(p2);
  position = p0;
  if ($recomputeNormals) normal = normalize(cross(p1 - p0, p2 - p0));
}
