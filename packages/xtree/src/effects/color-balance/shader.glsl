// Lift, gamma and gain per channel (the three color wheels of a grading tool), on display-encoded values.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  vec3 c = xt_linearToSrgb(max(color.rgb, 0.0));
  // Lift moves the blacks while leaving white in place; gain scales toward white; gamma bends the middle.
  vec3 graded = $gain * (c + $lift * (1.0 - c));
  graded = pow(max(graded, 0.0), 1.0 / max($gamma, vec3(0.05)));
  // Keep the overall brightness if asked, so the wheels only change hue.
  if ($preserveLuminance) {
    float before = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float after = dot(graded, vec3(0.2126, 0.7152, 0.0722));
    graded *= before / max(after, 1e-4);
  }
  return vec4(xt_srgbToLinear(max(mix(c, graded, $amount), 0.0)), color.a);
}
