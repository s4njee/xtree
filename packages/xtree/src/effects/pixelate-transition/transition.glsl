// Pixelate transition: the image breaks into growing blocks, switches at the coarsest point, and sharpens back into the next image.

vec4 $sampleBlocks(vec2 uv, float cell, bool next) {
  vec2 size = xt_size();
  vec2 st = (floor(uv * size / cell) + 0.5) * cell / size;
  return next ? xt_to(st) : xt_from(st);
}

vec4 $levels(vec2 uv, float cell, bool next) {
  // Power-of-two blocks on one nested grid, blended between neighboring levels, so blocks grow smoothly instead of re-sampling every frame (which would flicker).
  float level = log2(cell);
  float lo = floor(level);
  vec4 a = $sampleBlocks(uv, exp2(lo), next);
  vec4 b = $sampleBlocks(uv, exp2(lo + 1.0), next);
  return mix(a, b, smoothstep(0.0, 1.0, level - lo));
}

vec4 $transition(vec2 uv, float progress) {
  // Cell size rises to its maximum at the middle and falls back to one pixel.
  float rise = sin(3.14159265 * progress);
  float cell = mix(1.0, $maxCell, pow(rise, $curve));
  // Below a pixel the blocks are the image itself, which keeps both ends exact.
  if (cell < 1.001) return progress < 0.5 ? xt_from(uv) : xt_to(uv);
  float t = smoothstep(0.5 - $switchTime * 0.5, 0.5 + $switchTime * 0.5, progress);
  if (t <= 0.0) return $levels(uv, cell, false);
  if (t >= 1.0) return $levels(uv, cell, true);
  return mix($levels(uv, cell, false), $levels(uv, cell, true), t);
}
