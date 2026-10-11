// Image edges: Sobel gradients of display luma, optionally thinned by non-maximum suppression (the core of Canny), drawn as lines over the image, on paper, or alone.
#include <xtree/color/space>

float $luma(vec2 uv) {
  return dot(clamp(xt_linearToSrgb(max(xt_sample(uv).rgb, 0.0)), 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
}

vec2 $gradient(vec2 uv) {
  vec2 t = xt_texel * $thickness;
  float tl = $luma(uv + vec2(-t.x, t.y));
  float tc = $luma(uv + vec2(0.0, t.y));
  float tr = $luma(uv + t);
  float ml = $luma(uv - vec2(t.x, 0.0));
  float mr = $luma(uv + vec2(t.x, 0.0));
  float bl = $luma(uv - t);
  float bc = $luma(uv - vec2(0.0, t.y));
  float br = $luma(uv + vec2(t.x, -t.y));
  return vec2(tr + 2.0 * mr + br - tl - 2.0 * ml - bl, tl + 2.0 * tc + tr - bl - 2.0 * bc - br);
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 g = $gradient(uv);
  float magnitude = length(g);
#if $method == $method_canny
  // Keep only local maxima across the edge, for one-pixel lines.
  vec2 across = magnitude > 0.0 ? g / magnitude * xt_texel * $thickness : vec2(0.0);
  if (magnitude < length($gradient(uv + across)) || magnitude < length($gradient(uv - across))) magnitude = 0.0;
#endif
  float edge = smoothstep($threshold, $threshold * 1.5 + 0.02, magnitude);
#if $style == $style_overlay
  vec3 c = mix(color.rgb, $color, edge);
#elif $style == $style_ink
  vec3 c = mix($paper, $color, edge);
#else
  vec3 c = $color * edge;
#endif
  return vec4(c, color.a);
}
