// Dissolve: a value per surface point (noise, or height plus noise) compared with progress; below it is discarded.
#include <xtree/noise/fbm>

vec4 $fragment(vec4 color, XtSurface surface) {
  float n = xt_fbm(surface.objectPosition * $noiseScale, 4, 2.0, 0.5) * 0.5 + 0.5;
  float value;
  if ($pattern == $pattern_sweep) {
    float span = max($range.y - $range.x, 1e-4);
    value = (surface.worldPosition.y - $range.x) / span + (n - 0.5) * $noiseAmount;
  } else {
    // Stretch the noise so progress 0–1 covers it.
    value = clamp((n - 0.2) / 0.6, 0.0, 1.0);
  }
  // The edge band sits just ahead of the cut, and the cut reaches 1 + edge so progress 1 removes everything.
  float cut = $progress * (1.0 + $edgeWidth);
  if (value < cut - $edgeWidth) discard;
  float edge = 1.0 - smoothstep(cut - $edgeWidth, cut, value);
  if ($edgeWidth <= 0.0) edge = 0.0;
  return vec4(mix(color.rgb, $edgeColor * $edgeIntensity, edge), color.a);
}
