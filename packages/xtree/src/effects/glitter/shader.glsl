// Glitter: tiny flakes on surfaces, each with its own tilt, that flash when their tilted normal reflects a light that sweeps slowly (or follows the pointer).
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  vec3 n = xt_viewNormal(uv);
  if (n == vec3(0.0)) return color;
  vec2 cellUv = uv * xt_resolution / $size;
  vec2 cell = floor(cellUv);
  vec3 h = xt_hash3(cell + float($seed) * 13.1);
  if (h.z > $density) return color;
  // Each flake is tilted randomly away from the surface normal.
  vec3 flake = normalize(n + (vec3(xt_hash3(cell + 7.3)) - 0.5) * 1.6);
  float angle = xt_time * $speed * 0.6;
  vec2 pointer = (xt_pointer - 0.5) * 2.0;
  vec3 light = normalize(vec3(mix(vec2(cos(angle), sin(angle)) * 0.6, pointer, $followPointer), 1.0));
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 halfway = normalize(light + view);
  float spec = pow(max(dot(flake, halfway), 0.0), 60.0);
  // A round flake within its cell.
  float disc = 1.0 - smoothstep(0.25, 0.45, length(fract(cellUv) - h.xy * 0.4 - 0.3));
  vec3 tint = mix($color, vec3(0.5) + 0.5 * cos(6.2831853 * (h.x + vec3(0.0, 0.33, 0.67))), $rainbow);
  return vec4(color.rgb + tint * spec * disc * $intensity, color.a);
}
