// Volumetric fog: the scene seen through the marched fog, plus light scattered toward the camera in the fog color.
// Depth-aware upsampling: the four nearest low-resolution texels, weighted by how close their depth is to this pixel's, so the result doesn't bleed across silhouettes.
vec4 $upsample(sampler2D low, vec2 uv) {
  float centerDepth = xt_viewDepth(uv);
  vec2 size = vec2(textureSize(low, 0));
  vec2 p = uv * size - 0.5;
  vec2 f = fract(p);
  vec2 base = (floor(p) + 0.5) / size;
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 st = base + vec2(float(i), float(j)) / size;
      float bilinear = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
      float w = bilinear * exp(-abs(xt_viewDepth(st) - centerDepth) / (centerDepth * 0.05 + 1e-3)) + 1e-4;
      sum += texture(low, st) * w;
      total += w;
    }
  }
  return sum / total;
}

vec4 $main(vec4 color, vec2 uv) {
  vec4 fog = $upsample($fog, uv);
  return vec4(color.rgb * fog.a + fog.rgb * $color * $brightness, color.a);
}
