// Twirl: rotates the image around a center, most at the center and fading to none at the radius.
vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  vec2 d = (uv - $center) * aspect;
  float r = length(d) / $radius;
  if (r >= 1.0) return color;
  float falloff = (1.0 - r) * (1.0 - r);
  float angle = radians($angle) * falloff;
  float c = cos(angle);
  float s = sin(angle);
  vec2 rotated = mat2(c, s, -s, c) * d;
  return xt_sample($center + rotated / aspect);
}
