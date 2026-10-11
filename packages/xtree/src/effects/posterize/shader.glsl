// Toon posterize: brightness quantized into bands (keeping each pixel's hue and saturation), with darkened edges.
#include <xtree/color/space>

float $luma(vec2 uv) {
  return dot(clamp(xt_linearToSrgb(max(xt_sample(uv).rgb, 0.0)), 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
}

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = clamp(xt_linearToSrgb(max(color.rgb, 0.0)), 0.0, 1.0);
  vec3 hsv = xt_rgbToHsv(c);
  float bands = $bands;
  hsv.z = (floor(hsv.z * bands) + 0.5) / bands;
  hsv.y = min(1.0, hsv.y * $saturation);
  vec3 posterized = xt_hsvToRgb(hsv);
  // Edge darkening from the brightness gradient.
  vec2 t = xt_texel;
  float gx = $luma(uv + vec2(t.x, 0.0)) - $luma(uv - vec2(t.x, 0.0));
  float gy = $luma(uv + vec2(0.0, t.y)) - $luma(uv - vec2(0.0, t.y));
  float edge = smoothstep(0.08, 0.25, length(vec2(gx, gy))) * $edges;
  posterized *= 1.0 - edge;
  return vec4(xt_srgbToLinear(posterized), color.a);
}
