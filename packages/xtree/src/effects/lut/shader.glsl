// 3D LUT color grading with tetrahedral interpolation (texelFetch on the LUT texels).
#include <xtree/color/space>

#if $has_lut
vec3 $fetch(ivec3 i) {
  return texelFetch($lut, i, 0).rgb;
}

// Tetrahedral interpolation: picks one of the six tetrahedra of the cell by
// ordering the fractional coordinates, then blends its four corners.
vec3 $lookup(vec3 c) {
  float n = float(textureSize($lut, 0).x) - 1.0;
  vec3 p = clamp(c, 0.0, 1.0) * n;
  vec3 base = min(floor(p), vec3(n - 1.0));
  vec3 f = p - base;
  ivec3 a = ivec3(base);
  ivec3 b = a + 1;
  vec3 c000 = $fetch(a);
  vec3 c111 = $fetch(b);
  if (f.r > f.g) {
    if (f.g > f.b) {
      return (1.0 - f.r) * c000 + (f.r - f.g) * $fetch(ivec3(b.x, a.y, a.z)) + (f.g - f.b) * $fetch(ivec3(b.x, b.y, a.z)) + f.b * c111;
    } else if (f.r > f.b) {
      return (1.0 - f.r) * c000 + (f.r - f.b) * $fetch(ivec3(b.x, a.y, a.z)) + (f.b - f.g) * $fetch(ivec3(b.x, a.y, b.z)) + f.g * c111;
    }
    return (1.0 - f.b) * c000 + (f.b - f.r) * $fetch(ivec3(a.x, a.y, b.z)) + (f.r - f.g) * $fetch(ivec3(b.x, a.y, b.z)) + f.g * c111;
  }
  if (f.b > f.g) {
    return (1.0 - f.b) * c000 + (f.b - f.g) * $fetch(ivec3(a.x, a.y, b.z)) + (f.g - f.r) * $fetch(ivec3(a.x, b.y, b.z)) + f.r * c111;
  } else if (f.b > f.r) {
    return (1.0 - f.g) * c000 + (f.g - f.b) * $fetch(ivec3(a.x, b.y, a.z)) + (f.b - f.r) * $fetch(ivec3(a.x, b.y, b.z)) + f.r * c111;
  }
  return (1.0 - f.g) * c000 + (f.g - f.r) * $fetch(ivec3(a.x, b.y, a.z)) + (f.r - f.b) * $fetch(ivec3(b.x, b.y, a.z)) + f.b * c111;
}
#endif

vec4 $main(vec4 color, vec2 uv) {
#if $has_lut
  bool encoded = $space == $space_srgb;
  vec3 c = clamp(color.rgb, 0.0, 1.0);
  vec3 graded = $lookup(encoded ? xt_linearToSrgb(c) : c);
  if (encoded) graded = xt_srgbToLinear(max(graded, 0.0));
  return vec4(mix(color.rgb, graded, $intensity), color.a);
#else
  return color;
#endif
}
