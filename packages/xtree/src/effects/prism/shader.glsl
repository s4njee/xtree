// Prism: the image split into a spectrum along the direction away from a center, each sample tinted by its wavelength's color, as light through a prism.
#include <xtree/color/spectral>

vec4 $main(vec4 color, vec2 uv) {
  vec2 aspect = vec2(xt_resolution.x / xt_resolution.y, 1.0);
  vec2 d = (uv - $center) * aspect;
  float r = length(d);
  vec2 dir = r > 0.0 ? d / r : vec2(0.0);
  vec2 shift = dir * pow(r, $falloff) * $spread / aspect;
  vec3 sum = vec3(0.0);
  vec3 weight = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    if (i >= $samples) break;
    float t = (float(i) + 0.5) / float($samples);
    vec3 tint = max(xt_wavelengthToLinearSrgb(mix(400.0, 700.0, t)), 0.0);
    sum += xt_sample(uv + shift * (t - 0.5) * 2.0).rgb * tint;
    weight += tint;
  }
  vec3 split = sum / max(weight, vec3(1e-4));
  return vec4(mix(color.rgb, split, $amount), color.a);
}
