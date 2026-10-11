// Frosted glass: the blurred frame seen through a rippled pane, tinted, with fine frost grain.
#include <xtree/noise/value>

vec4 $main(vec4 color, vec2 uv) {
  vec2 p = uv * xt_resolution / $frostScale;
  vec2 ripple = vec2(xt_valueNoise(xt_seeded(p, $seed)), xt_valueNoise(xt_seeded(p + 17.3, $seed))) - 0.5;
  vec3 seen = texture($blurred, uv + ripple * $distortion / xt_resolution).rgb;
  vec3 tinted = mix(seen, seen * 0.6 + $tint * 0.4, $tintAmount);
  float grain = (xt_valueNoise(xt_seeded(uv * xt_resolution * 0.8, $seed)) - 0.5) * $grain;
  return vec4(max(tinted + grain, 0.0), color.a);
}
