// Depth of field: a single-pass gather along a golden-angle spiral (Gustafsson, "Bokeh depth of field in a single pass", 2018).
// Samples behind the center pixel can't blur over it more than the center's own blur, which keeps sharp edges in front.
#include <xtree/sampling/spiral>

float $focus() {
  return $focusMode == $focusMode_point ? xt_viewDepth($focusPoint) : $focusDistance;
}

// Signed blur radius in pixels: negative in front of the focus, positive behind it.
float $coc(float depth, float focus) {
  float away = max(abs(depth - focus) - 0.5 * $focusRange, 0.0) / max(depth, 1e-3);
  return sign(depth - focus) * min(away * $aperture, 1.0) * $maxBlur;
}

// Scales a spiral offset at `angle` so the samples fill a hexagon instead of a circle.
float $shapeScale(float angle) {
  if ($shape != $shape_hexagon) return 1.0;
  float sector = mod(angle, 1.0471976) - 0.5235988;
  return 0.8660254 / cos(sector);
}

vec4 $main(vec4 color, vec2 uv) {
#if $resolution == $resolution_half
  // The blur was gathered at half resolution. Upsample it from the four nearest texels, weighted by how close their depth is to this pixel's, so it doesn't bleed across silhouettes; in-focus pixels stay sharp.
  float focus = $focus();
  float centerDepth = xt_viewDepth(uv);
  float centerCoc = $coc(centerDepth, focus);
  float centerSize = abs(centerCoc);
  vec2 size = vec2(textureSize($gathered, 0));
  vec2 p = uv * size - 0.5;
  vec2 f = fract(p);
  vec2 base = (floor(p) + 0.5) / size;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 st = base + vec2(float(i), float(j)) / size;
      float bilinear = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
      float w = bilinear * exp(-abs(xt_viewDepth(st) - centerDepth) / (centerDepth * 0.05 + 1e-3)) + 1e-4;
      sum += texture($gathered, st).rgb * w;
      total += w;
    }
  }
  vec3 result = mix(xt_sample(uv).rgb, sum / total, smoothstep(0.5, 2.0, centerSize));
#else
  float focus = $focus();
  float centerDepth = xt_viewDepth(uv);
  float centerCoc = $coc(centerDepth, focus);
  float centerSize = abs(centerCoc);
  vec3 sum = xt_sample(uv).rgb;
  float total = 1.0;
  float spacing = $density == $density_low ? 2.0 : ($density == $density_medium ? 1.0 : 0.5);
  float radius = spacing;
  float angle = 0.0;
  // At most a few hundred taps: radius grows by spacing / radius each iteration.
  for (int i = 0; i < 2048 && radius < $maxBlur; i++) {
    // Texel centers keep color and depth from the same pixel; a filtered color across a silhouette would leak HDR highlights.
    vec2 st = (floor(uv * xt_resolution + vec2(cos(angle), sin(angle)) * $shapeScale(angle) * radius) + 0.5) * xt_texel;
    vec3 sampled = xt_sample(st).rgb;
    float sampleDepth = xt_viewDepth(st);
    float sampleSize = abs($coc(sampleDepth, focus));
    if (sampleDepth > centerDepth) sampleSize = min(sampleSize, centerSize * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
    sum += mix(sum / total, sampled, m);
    total += 1.0;
    radius += spacing / radius;
    angle += XT_GOLDEN_ANGLE;
  }
  vec3 result = sum / total;
#endif
  if ($showFocus) {
    vec3 tint = centerSize < 0.5 ? vec3(0.2, 1.0, 0.3) : (centerCoc < 0.0 ? vec3(1.0, 0.3, 0.2) : vec3(0.3, 0.5, 1.0));
    result = mix(result, tint * dot(result, vec3(0.2126, 0.7152, 0.0722)) * 2.0 + tint * 0.05, 0.5);
  }
  return vec4(result, color.a);
}
