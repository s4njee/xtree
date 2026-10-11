// Triplanar mapping (multiplied at twice the texture, so a mid-gray texture keeps the brightness): a texture projected along the three world axes and blended by how much the surface faces each, so it wraps any shape without UVs or seams.
#include <xtree/color/space>

vec3 $pattern(vec2 p) {
#if $has_map
  return xt_srgbToLinear(texture($map, p).rgb);
#else
  // Built in: a two-tone grid of tiles with grout lines.
  vec2 cell = fract(p);
  float tile = mod(floor(p.x) + floor(p.y), 2.0);
  float grout = step(0.06, cell.x) * step(0.06, cell.y);
  return mix(vec3(0.08), mix($colorA, $colorB, tile), grout);
#endif
}

vec4 $fragment(vec4 color, XtSurface surface) {
  vec3 p = ($space == $space_object ? surface.objectPosition : surface.worldPosition) * $scale;
  vec3 n = normalize($space == $space_object ? surface.objectNormal : surface.worldNormal);
  // Blend weights sharpen with the exponent, then sum to one.
  vec3 w = pow(abs(n), vec3($sharpness));
  w /= max(w.x + w.y + w.z, 1e-5);
  vec3 t = $pattern(p.zy) * w.x + $pattern(p.xz) * w.y + $pattern(p.xy) * w.z;
  vec3 c = $mode == $mode_multiply ? color.rgb * t * 2.0 : t * max(dot(color.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0) * 2.0;
  return vec4(mix(color.rgb, c, $amount), color.a);
}
