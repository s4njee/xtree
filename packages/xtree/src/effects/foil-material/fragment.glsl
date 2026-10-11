// Foil material: a spectral band position from the surface coordinate plus the local viewing angle.
#include <xtree/color/space>
#include <xtree/color/luminance>
#include <xtree/noise/simplex>
#include <xtree/noise/hash>

vec4 $fragment(vec4 color, XtSurface surface) {
  // UVs when the mesh has them, object position otherwise.
  vec2 p = surface.uv != vec2(0.0) ? surface.uv : surface.objectPosition.xy + surface.objectPosition.z * 0.37;
  // How the surface tilts relative to the camera: the normal seen from the view direction.
  vec2 tilt = surface.viewNormal.xy - surface.viewDirection.xy * dot(surface.viewNormal, surface.viewDirection);
  float t = $time * $speed;
  float phase;
  if ($pattern == $pattern_radial) {
    phase = length(p - 0.5);
  } else if ($pattern == $pattern_cosmos) {
    phase = dot(p, vec2(0.8, 0.6)) + 0.25 * xt_simplex(vec3(p * 2.5, t * 0.15));
  } else {
    phase = dot(p, vec2(0.8, 0.6));
  }
  phase = phase * $scale + dot(tilt, vec2(0.6, 0.35)) * $angleResponse;
  vec3 foil = xt_srgbToLinear(xt_hsvToRgb(vec3(fract(phase), $saturation, 1.0))) * $tint;

  float lum = xt_luminance(color.rgb);
  vec3 result = color.rgb * mix(vec3(1.0), foil * 2.0, $intensity) + foil * $sheen * min(lum * 2.0 + 0.1, 1.0);

  if ($sparkle > 0.0) {
    vec2 cell = floor(p * 60.0);
    vec3 h = xt_hash3(cell);
    float point = smoothstep(0.35, 0.0, length(fract(p * 60.0) - (0.25 + h.zy * 0.5)));
    float glint = step(1.0 - $sparkle * 0.2, h.x) * point;
    // Each glint lights up only for a narrow range of viewing angles.
    float twinkle = pow(max(0.0, cos(6.2831853 * (h.y + dot(tilt, h.zx - 0.5) * 3.0))), 24.0);
    result += glint * twinkle * 2.0 * $tint;
  }
  return vec4(result, color.a);
}
