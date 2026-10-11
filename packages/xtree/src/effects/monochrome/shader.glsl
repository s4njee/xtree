// Greyscale, sepia or a two-color duotone, mixed in display-encoded space.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 toned;
  if ($mode == $mode_sepia) {
    toned = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
  } else if ($mode == $mode_duotone) {
    toned = mix(xt_linearToSrgb($shadows), xt_linearToSrgb($highlights), smoothstep(0.0, 1.0, luma));
  } else {
    toned = vec3(luma);
  }
  return vec4(xt_srgbToLinear(max(mix(c, toned, $amount), 0.0)), color.a);
}
