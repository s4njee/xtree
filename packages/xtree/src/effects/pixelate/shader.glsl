// Pixelate: samples each square or hexagonal cell at its center; dots mask the cell to a circle.
vec4 $main(vec4 color, vec2 uv) {
  vec2 px = uv * xt_resolution;
  vec2 center;
  if ($shape == $shape_hex) {
    vec2 size = vec2(1.7320508, 1.0) * $size;
    vec2 a = mod(px, size) - size * 0.5;
    vec2 b = mod(px - size * 0.5, size) - size * 0.5;
    center = px - (dot(a, a) < dot(b, b) ? a : b);
  } else {
    center = (floor(px / $size) + 0.5) * $size;
  }
  vec4 cell = xt_sample(clamp(center * xt_texel, 0.0, 1.0));
  if ($shape == $shape_dots) {
    float d = length(px - center) / ($size * 0.5);
    float edge = 1.0 - $gap;
    cell.rgb *= 1.0 - smoothstep(edge - 1.5 / $size, edge, d);
  }
  return vec4(cell.rgb, color.a);
}
