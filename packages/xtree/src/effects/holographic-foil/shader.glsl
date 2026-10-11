// Holographic foil: an iridescent spectral overlay that shifts with the viewing angle.
#include <xtree/color/space>
#include <xtree/color/luminance>
#include <xtree/noise/simplex>
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  float aspect = xt_resolution.x / xt_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float t = xt_time * $speed;
  float a = radians($angle);
  vec2 dir = vec2(cos(a), sin(a));
  float phase;
  if ($pattern == $pattern_radial) {
    phase = length(p - $tilt * 0.35);
  } else if ($pattern == $pattern_cosmos) {
    phase = dot(p, dir) + 0.25 * xt_simplex(vec3(p * 2.5, t * 0.15));
  } else {
    phase = dot(p, dir);
  }
  phase = phase * $scale + dot($tilt, vec2(0.6, 0.35)) + t * 0.05 + $hueShift;
  vec3 foil = xt_srgbToLinear(xt_hsvToRgb(vec3(fract(phase), $saturation, 1.0))) * $tint;

  float lum = xt_luminance(color.rgb);
  float mask = mix(1.0, smoothstep(0.02, 0.8, lum), $luminanceMask);
  // Iridescent tint: multiplies the image by the foil around its mean, so dark
  // areas stay dark and lit surfaces shift through the spectrum.
  vec3 tinted = color.rgb * mix(vec3(1.0), foil * 2.0, $intensity * mask);
  // Specular sheen: the foil added on top, strongest on bright areas.
  vec3 result = tinted + foil * $sheen * mask * min(lum * 2.0 + 0.1, 1.0);

  if ($sparkle > 0.0) {
    const float cellSize = 5.0;
    vec2 pixel = uv * xt_resolution / cellSize;
    vec2 cell = floor(pixel);
    vec3 h = xt_hash3(cell);
    float point = smoothstep(0.35, 0.0, length(fract(pixel) - (0.25 + h.zy * 0.5)));
    float glint = step(1.0 - $sparkle * 0.2, h.x) * point;
    float twinkle = pow(max(0.0, cos(6.28318530718 * (h.y + dot($tilt, h.zx - 0.5) * 1.5 + t * 0.2))), 24.0);
    result += glint * twinkle * 2.0 * mix(0.3, 1.0, mask) * $tint;
  }
  return vec4(result, color.a);
}
