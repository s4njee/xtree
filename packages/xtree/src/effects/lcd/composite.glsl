// LCD: each screen pixel is a cell of three colored subpixel stripes (or a PenTile-like diagonal), lit by the image at the cell's center, with dark gaps.
vec4 $main(vec4 color, vec2 uv) {
  vec2 cellUv = uv * xt_resolution / $cellSize;
  vec2 cell = floor(cellUv);
  vec2 local = fract(cellUv);
  vec3 c = texture($persisted, (cell + 0.5) * $cellSize / xt_resolution).rgb;
  float stripe = floor(local.x * 3.0);
#if $layout == $layout_bgr
  stripe = 2.0 - stripe;
#elif $layout == $layout_diagonal
  stripe = mod(floor(local.x * 3.0) + cell.y, 3.0);
#endif
  vec3 mask = vec3(stripe == 0.0, stripe == 1.0, stripe == 2.0);
  // Gaps between subpixels and between rows.
  float sub = fract(local.x * 3.0);
  float gapX = smoothstep(0.0, $gap, sub) * smoothstep(0.0, $gap, 1.0 - sub);
  float gapY = smoothstep(0.0, $gap * 0.5, local.y) * smoothstep(0.0, $gap * 0.5, 1.0 - local.y);
  // Three times the light per channel keeps the average brightness of the original.
  vec3 lit = c * mask * 3.0 * gapX * gapY * $brightness;
  return vec4(mix(color.rgb, lit, $amount), color.a);
}
