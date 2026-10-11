// Chromatic fresnel rim: the rim of the surface split into a spectrum, as a soap film or dispersive glass catches light at grazing angles.
#include <xtree/color/spectral>

vec4 $fragment(vec4 color, XtSurface surface) {
  float facing = clamp(abs(dot(surface.viewNormal, surface.viewDirection)), 0.0, 1.0);
  float rim = pow(1.0 - facing, $power);
  // The hue runs across the rim: violet at the inside, red at the silhouette (or the other way).
  float t = clamp((1.0 - facing - (1.0 - $width)) / max($width, 1e-3), 0.0, 1.0);
  if ($reverse) t = 1.0 - t;
  vec3 spectrum = max(xt_wavelengthToLinearSrgb(mix(400.0, 700.0, t)), 0.0) * 1.8;
  return vec4(color.rgb + spectrum * rim * $intensity, color.a);
}
