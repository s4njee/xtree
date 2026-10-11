// Invert or threshold, on display-encoded values.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  vec3 result;
  if ($mode == $mode_invert) {
    result = 1.0 - clamp(c, 0.0, 1.0);
  } else {
    vec3 v = $perChannel ? c : vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)));
    result = smoothstep(vec3($level - $smoothness), vec3($level + $smoothness), v);
  }
  return vec4(xt_srgbToLinear(mix(c, result, $amount)), color.a);
}
