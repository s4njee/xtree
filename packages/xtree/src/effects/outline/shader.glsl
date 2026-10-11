// Outline: edges from the second difference of inverse depth and from normal changes, or around a dilated selection mask.
vec4 $main(vec4 color, vec2 uv) {
  vec2 o = xt_texel * $thickness;
  float edge;
#if $has_mask
  // Outer outline: the strongest mask value around the pixel, minus its own.
  float inside = $maskAt(uv);
  float around = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    around = max(around, $maskAt(uv + vec2(cos(a), sin(a)) * o));
  }
  edge = clamp(around - inside, 0.0, 1.0);
#else
  // 1/depth is affine in screen space across a plane, so its second difference
  // is zero on flat surfaces (even at grazing angles) and large at silhouettes and creases.
  vec2 x = vec2(o.x, 0.0);
  vec2 y = vec2(0.0, o.y);
  float c = 1.0 / max(xt_viewDepth(uv), 1e-4);
  float l = 1.0 / max(xt_viewDepth(uv - x), 1e-4);
  float r = 1.0 / max(xt_viewDepth(uv + x), 1e-4);
  float d = 1.0 / max(xt_viewDepth(uv - y), 1e-4);
  float u = 1.0 / max(xt_viewDepth(uv + y), 1e-4);
  float depthEdge = (abs(l + r - 2.0 * c) + abs(d + u - 2.0 * c)) / c;
  edge = smoothstep($depthThreshold, $depthThreshold * 1.5, depthEdge);
#if $edges == $edges_depthAndNormals
  // Second difference again: smooth curvature bends normals evenly, a crease doesn't.
  vec3 nc = 2.0 * xt_viewNormal(uv);
  float normalEdge = length(xt_viewNormal(uv - x) + xt_viewNormal(uv + x) - nc) + length(xt_viewNormal(uv - y) + xt_viewNormal(uv + y) - nc);
  edge = max(edge, smoothstep($normalThreshold, $normalThreshold * 1.5, normalEdge));
#endif
#endif
  vec3 base = $style == $style_ink ? $paper : color.rgb;
  return vec4(mix(base, $color, edge), color.a);
}
