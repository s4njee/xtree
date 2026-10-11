// Matcap: the surface color looked up from a sphere image by the view-space normal, so any material takes on a sculpted, pre-lit look.
#include <xtree/color/space>

vec3 $studio(vec2 n) {
  // A built-in clay matcap: soft key light from the upper left, a rim from behind and a dark base.
  vec3 normal = vec3(n, sqrt(max(0.0, 1.0 - dot(n, n))));
  float key = max(dot(normal, normalize(vec3(-0.5, 0.6, 0.7))), 0.0);
  float fill = max(dot(normal, normalize(vec3(0.6, -0.2, 0.5))), 0.0) * 0.25;
  float rim = pow(1.0 - normal.z, 3.0) * 0.6;
  float spec = pow(max(dot(normal, normalize(vec3(-0.35, 0.45, 0.8))), 0.0), 40.0) * 0.6;
  return vec3(0.04 + key * 0.75 + fill + rim) * $tint + spec;
}

vec4 $fragment(vec4 color, XtSurface surface) {
  vec3 n = normalize(surface.viewNormal);
  // Correct for perspective, as three.js's MeshMatcapMaterial does.
  vec3 x = normalize(vec3(surface.viewDirection.z, 0.0, -surface.viewDirection.x));
  vec3 y = cross(surface.viewDirection, x);
  vec2 uv = vec2(dot(x, n), dot(y, n)) * 0.495;
  vec3 matcap;
#if $has_map
  matcap = xt_srgbToLinear(texture($map, uv + 0.5).rgb) * $tint;
#else
  matcap = $studio(uv * 2.0);
#endif
  vec3 c = $mode == $mode_multiply ? color.rgb * matcap * 2.0 : matcap;
  return vec4(mix(color.rgb, c, $amount), color.a);
}
