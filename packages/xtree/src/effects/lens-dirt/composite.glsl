// Lens dirt: smudges, rings and specks on the lens, lit by the bloom of the bright light passing over them.
#include <xtree/noise/value>
#include <xtree/noise/hash>

float $dirt(vec2 uv) {
  vec2 p = uv * vec2(xt_resolution.x / xt_resolution.y, 1.0) / $scale + $seed * 7.31;
  float smudge = xt_valueNoise(p * 2.5) * 0.65 + xt_valueNoise(p * 6.0 + 3.7) * 0.35;
  float dirt = smoothstep(0.5, 0.85, smudge) * 0.7;
  // Dust specks and rings on a jittered grid.
  vec2 cell = floor(p * 9.0);
  vec2 local = fract(p * 9.0);
  vec3 h = xt_hash3(cell + $seed);
  float r = length(local - h.xy);
  float size = 0.05 + h.z * 0.18;
  float speck = h.z > 0.55 ? 1.0 - smoothstep(size * 0.6, size, r) : 0.0;
  float ring = h.z > 0.9 ? smoothstep(0.02, 0.0, abs(r - size * 1.6)) * 0.6 : 0.0;
  return clamp(dirt + speck * 0.8 + ring, 0.0, 1.0);
}

vec4 $main(vec4 color, vec2 uv) {
  vec3 glow = texture($bloom, uv).rgb;
  return vec4(color.rgb + glow * $dirt(uv) * $intensity, color.a);
}
