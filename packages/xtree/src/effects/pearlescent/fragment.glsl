// Pearlescent: a soft, view-dependent sheen whose hue shifts with the angle and from flake to flake, like pearl, opal or car paint.
#include <xtree/noise/value>

vec4 $fragment(vec4 color, XtSurface surface) {
  float facing = clamp(abs(dot(surface.viewNormal, surface.viewDirection)), 0.0, 1.0);
  // Flakes: cells of slightly different orientation in object space.
  vec3 p = surface.objectPosition / max($flakeScale, 1e-3);
  float flake = xt_valueNoise(xt_seeded(p, $seed)) * 0.6 + xt_valueNoise(xt_seeded(p * 2.7 + 5.1, $seed)) * 0.4;
  float hue = $hueOffset + (1.0 - facing) * $hueRange + (flake - 0.5) * $flakeVariation;
  vec3 tint = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
  // Pearl is pale: mix the hue toward white.
  tint = mix(vec3(1.0), tint, $saturation);
  float sheen = mix(0.4, 1.0, pow(1.0 - facing, 1.5)) * $sheen;
  vec3 base = mix(color.rgb, color.rgb * tint, $tintBase);
  return vec4(base + tint * sheen * 0.5, color.a);
}
