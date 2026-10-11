// Split toning: tint the shadows and the highlights with two colors, split at a balance point of display brightness.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  vec3 clamped = clamp(c, 0.0, 1.0);
  float luma = dot(clamped, vec3(0.2126, 0.7152, 0.0722));
  float split = 0.5 + 0.5 * $balance;
  float highlight = smoothstep(split - 0.25, split + 0.25, luma);
  vec3 tint = mix(xt_linearToSrgb($shadows), xt_linearToSrgb($highlights), highlight);
  // Soft-light-style toning: keeps the brightness and shifts the hue toward the tint.
  // HDR values above 1 are left as they are.
  vec3 toned = c + (tint - 0.5) * 2.0 * clamped * (1.0 - clamped);
  return vec4(xt_srgbToLinear(max(mix(c, toned, $amount), 0.0)), color.a);
}
