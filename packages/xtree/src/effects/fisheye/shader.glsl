// Fisheye (equidistant) and Panini projections of the rectilinear frame. Each output pixel finds its view direction under the chosen projection, then where that direction lands in the original perspective image.

// The view direction's tangent-plane position for an output point under the projection, in units of the original image's half-width tangent.
vec2 $project(vec2 p, float halfFov) {
#if $projection == $projection_panini
  // Panini (Sharpless et al., 2010) with distance d = strength; d = 0 is rectilinear, d = 1 classic Panini.
  float d = $strength;
  // d = 0 is exactly rectilinear; skip the trigonometry, whose GPU precision would shift fine detail.
  if (d <= 0.0) return p;
  vec2 q = p * tan(halfFov);
  float k = q.x * q.x / ((d + 1.0) * (d + 1.0));
  float dscr = k * k * d * d - (k + 1.0) * (k * d * d - 1.0);
  float clon = (-k * d + sqrt(max(dscr, 0.0))) / (k + 1.0);
  float s = (d + 1.0) / (d + clon);
  float lon = atan(q.x, s * clon);
  float lat = atan(q.y, s);
  return vec2(tan(lon), tan(lat) / cos(lon)) / tan(halfFov);
#else
  // Equidistant fisheye: radius proportional to the angle from the axis, blended from rectilinear by strength.
  float r = length(p);
  if (r < 1e-5) return p;
  float maxAngle = mix(halfFov, 1.45, $strength);
  float theta = r * maxAngle;
  float rectilinear = tan(min(theta, 1.55)) / tan(maxAngle);
  return p / r * mix(r, rectilinear, $strength);
#endif
}

vec4 $main(vec4 color, vec2 uv) {
  float aspect = xt_resolution.x / xt_resolution.y;
  // Normalize so the frame's half-diagonal is 1, then zoom.
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float halfDiagonal = length(vec2(aspect, 1.0)) * 0.5;
  p = p / halfDiagonal / $zoom;
  float halfFov = radians($fov) * 0.5;
  vec2 q = $project(p, halfFov) * halfDiagonal;
  vec2 st = q / vec2(aspect, 1.0) + 0.5;
  if (any(lessThan(st, vec2(0.0))) || any(greaterThan(st, vec2(1.0))))
    return $edges ? vec4(0.0, 0.0, 0.0, color.a) : xt_sample(clamp(st, 0.0, 1.0));
  return xt_sample(st);
}
