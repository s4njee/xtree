// Displacement map: offsets the lookup by a texture (or simplex noise) centered on 0.5.
#include <xtree/noise/simplex>

vec4 $main(vec4 color, vec2 uv) {
  float aspect = xt_resolution.x / xt_resolution.y;
  vec2 p = uv * vec2(aspect, 1.0) * $scale - $scroll * xt_time;
#if $has_map
  // The seed shifts where a repeating map is read (seed 0 leaves it in place).
  vec3 value = texture($map, xt_seeded(p, $seed)).rgb;
#else
  vec3 value = vec3(xt_simplex(xt_seeded(p * 2.0, $seed)), xt_simplex(xt_seeded(p * 2.0 + 17.3, $seed)), 0.0) * 0.5 + 0.5;
  value.b = 0.5 * (value.r + value.g);
#endif
  vec2 offset;
  if ($channel == $channel_luminance) {
    float a = radians($angle);
    offset = (dot(value, vec3(0.2126, 0.7152, 0.0722)) - 0.5) * 2.0 * vec2(cos(a), sin(a));
  } else {
    offset = (value.rg - 0.5) * 2.0;
  }
  vec2 st = uv + offset * $strength / vec2(aspect, 1.0);
  return vec4(xt_sample(clamp(st, 0.0, 1.0)).rgb, color.a);
}
