// Morph: both images are pushed along a displacement field, the old one outward as it fades and the new one settling into place, so shapes appear to flow into each other.
#include <xtree/noise/fbm>

vec2 $displacement(vec2 uv) {
#if $has_map
  // The map's red and green channels, centered on 0.5, are the direction.
  return texture($map, uv).rg * 2.0 - 1.0;
#else
  vec2 size = xt_size();
  vec2 p = uv * vec2(size.x / size.y, 1.0) * $scale;
  return vec2(xt_fbm(xt_seeded(p, $seed), 4, 2.0, 0.5), xt_fbm(xt_seeded(p + 17.3, $seed), 4, 2.0, 0.5));
#endif
}

vec4 $transition(vec2 uv, float progress) {
  vec2 d = $displacement(uv) * $strength;
  float t = smoothstep(0.0, 1.0, progress);
  vec4 from = xt_from(uv + d * progress);
  vec4 to = xt_to(uv - d * (1.0 - progress));
  return mix(from, to, t);
}
