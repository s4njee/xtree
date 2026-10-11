// Bleach bypass (silver retained: a desaturated, high-contrast overlay of the image's own luma) and cross processing (slide film in negative chemistry: per-channel S-curves).
#include <xtree/color/space>

vec3 $overlay(vec3 base, vec3 blend) {
  return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), step(0.5, base));
}

vec4 $main(vec4 color, vec2 uv) {
  vec3 display = xt_linearToSrgb(max(color.rgb, 0.0));
  vec3 c = clamp(display, 0.0, 1.0);
#if $mode == $mode_bleach
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 processed = mix(c, $overlay(vec3(luma), c), 0.9);
  processed = mix(vec3(dot(processed, vec3(0.2126, 0.7152, 0.0722))), processed, 0.55);
#else
  // Contrast curves that push red and green up and hold blue down, with yellow-green highlights.
  vec3 s = c * c * (3.0 - 2.0 * c);
  vec3 processed = vec3(
    mix(c.r, s.r, 0.9),
    mix(c.g, s.g, 0.6) * 1.04 + 0.02,
    c.b * 0.78 + 0.12
  );
#endif
  // The look covers 0–1; HDR values above 1 keep their excess.
  vec3 graded = clamp(processed, 0.0, 1.0) + (display - c);
  return vec4(xt_srgbToLinear(max(mix(display, graded, $amount), 0.0)), color.a);
}
