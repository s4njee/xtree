// Pixelate transition: the image breaks into growing blocks, switches at the coarsest point, and sharpens back into the next image.

const int $taps = 3;

vec4 $sampleBlocks(vec2 uv, float cell, bool next) {
  // Each block is the average of a grid of taps across it, not one point: a
  // point sample of a detailed image swings between light and dark as the
  // blocks change size, while a block's average is the average of the blocks
  // it splits into, so it changes smoothly.
  vec2 size = xt_size();
  vec2 corner = floor(uv * size / cell) * cell;
  vec4 sum = vec4(0.0);
  for (int y = 0; y < $taps; y++)
    for (int x = 0; x < $taps; x++) {
      vec2 st = (corner + (vec2(x, y) + 0.5) * cell / float($taps)) / size;
      sum += next ? xt_to(st) : xt_from(st);
    }
  return sum / float($taps * $taps);
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
  // Clamped: sin(pi) can come out slightly negative, and pow() of a negative is undefined.
  float rise = max(sin(3.14159265 * progress), 0.0);
  float cell = mix(1.0, $maxCell, pow(rise, $curve));
  // Below a pixel the blocks are the image itself, which keeps both ends exact.
  if (cell < 1.001) return progress < 0.5 ? xt_from(uv) : xt_to(uv);
  // smoothstep() with equal edges is undefined, so a zero switch time is a plain cut.
  float t = $switchTime > 0.0 ? smoothstep(0.5 - $switchTime * 0.5, 0.5 + $switchTime * 0.5, progress) : step(0.5, progress);
  if (t <= 0.0) return $levels(uv, cell, false);
  if (t >= 1.0) return $levels(uv, cell, true);
  return mix($levels(uv, cell, false), $levels(uv, cell, true), t);
}
