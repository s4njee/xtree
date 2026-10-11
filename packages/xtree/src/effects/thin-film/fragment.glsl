// Thin film: thickness from noise or height, then interference color at the viewing angle.
#include <xtree/color/spectral>
#include <xtree/noise/simplex>

vec4 $fragment(vec4 color, XtSurface surface) {
  float cosTheta = clamp(abs(dot(surface.viewNormal, surface.viewDirection)), 0.0, 1.0);
  float t;
  if ($variation == $variation_height) {
    t = fract(surface.objectPosition.y * $scale * 0.5 + 0.1 * xt_simplex(vec3(surface.objectPosition * 2.0 + $time * $speed)));
  } else if ($variation == $variation_uniform) {
    t = 0.0;
  } else {
    t = xt_simplex(vec3(surface.objectPosition * $scale + vec3(0.0, $time * $speed, 0.0))) * 0.5 + 0.5;
  }
  float thickness = mix($thicknessMin, $thicknessMax, t);
  vec3 film = xt_thinFilm(thickness, $ior, cosTheta);
  // Tint around the film's mean (0.5) so overall brightness holds; add a grazing-angle reflection.
  vec3 tinted = color.rgb * mix(vec3(1.0), film * 2.0, $intensity);
  float grazing = pow(1.0 - cosTheta, 3.0) * 0.8 + 0.2;
  return vec4(tinted + film * $sheen * grazing, color.a);
}
