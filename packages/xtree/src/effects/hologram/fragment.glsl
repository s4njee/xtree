// Hologram: additive color from rim, scanlines and the original shading, with a slow flicker.
#include <xtree/color/luminance>
#include <xtree/noise/simplex>

vec4 $fragment(vec4 color, XtSurface surface) {
  float facing = clamp(abs(dot(surface.viewNormal, surface.viewDirection)), 0.0, 1.0);
  float rim = pow(1.0 - facing, $rimPower) * $rimIntensity;
  float shade = mix(1.0, clamp(xt_luminance(color.rgb) * 2.0, 0.0, 1.0), $shading);
  float lines = 1.0;
  if ($scanlineDensity > 0.0) {
    float wave = 0.5 + 0.5 * sin(6.2831853 * (surface.worldPosition.y - $time * $scanlineSpeed) * $scanlineDensity);
    lines = 1.0 - $scanlineStrength * (1.0 - wave);
  }
  // Smooth noise at about 1.5 Hz: a wobble, not a strobe.
  float flicker = 1.0 - $flicker * (0.5 + 0.5 * xt_simplex(vec2($time * 1.5, 0.0)));
  vec3 light = $color * $intensity * (0.35 * shade + rim) * lines * flicker;
  return vec4(light, 1.0);
}
