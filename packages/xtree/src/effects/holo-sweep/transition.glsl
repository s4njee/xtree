// Holographic sweep: a band of spectral color sweeps across, refracting the image as it passes and leaving the next image behind it.
#include <xtree/color/spectral>

vec4 $transition(vec2 uv, float progress) {
  vec2 size = xt_size();
  vec2 aspect = vec2(size.x / size.y, 1.0);
  float a = radians($angle);
  vec2 dir = vec2(cos(a), sin(a));
  float reach = abs(dir.x) * aspect.x * 0.5 + abs(dir.y) * 0.5;
  float x = dot((uv - 0.5) * aspect, dir) / (2.0 * reach) + 0.5;
  // The band runs from fully before 0 to fully past 1.
  float w = $width;
  float center = progress * (1.0 + 2.0 * w) - w;
  float offset = x - center;
  if (offset <= -w) return xt_to(uv);
  if (offset >= w) return xt_from(uv);
  // Position across the band, -1 to 1.
  float s = offset / w;
  float strength = 1.0 - s * s;
  // Refraction: each color channel is displaced a little differently across the band.
  vec2 push = dir / aspect * strength * $refraction;
  float t = smoothstep(0.6, -0.6, s);
  vec4 from = vec4(xt_from(uv + push * 1.2).r, xt_from(uv + push).g, xt_from(uv + push * 0.8).b, xt_from(uv).a);
  vec4 to = vec4(xt_to(uv - push * 0.8).r, xt_to(uv - push).g, xt_to(uv - push * 1.2).b, xt_to(uv).a);
  vec4 color = mix(from, to, t);
  // The spectrum across the band, from red at its leading edge to violet behind. It tints the image at its own brightness rather than adding light, so the passing band never flashes (WCAG 2.3.1); a partial tint also keeps the red end short of a saturated-red flash.
  float wavelength = mix(700.0, 400.0, s * 0.5 + 0.5);
  vec3 spectrum = max(xt_wavelengthToLinearSrgb(wavelength), 0.0);
  const vec3 weights = vec3(0.2126, 0.7152, 0.0722);
  vec3 tint = spectrum / max(dot(spectrum, weights), 1e-3);
  float amount = clamp(strength * $intensity * 0.5, 0.0, 0.7);
  vec3 tinted = color.rgb * mix(vec3(1.0), tint, amount);
  float before = dot(color.rgb, weights);
  tinted *= before / max(dot(tinted, weights), 1e-4);
  // A faint sheen on top.
  color.rgb = tinted + spectrum * strength * strength * $intensity * 0.04;
  return color;
}
