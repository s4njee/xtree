// Lens flare composite: the blurred ghosts and halo, brightened by procedural lens dirt and modulated by a starburst.
#include <xtree/noise/value>

// Smudges and specks that light up where the flare passes over them.
float $dirt(vec2 uv) {
  vec2 p = uv * vec2(xt_resolution.x / xt_resolution.y, 1.0);
  float smudge = xt_valueNoise(xt_seeded(p * 3.0, $seed)) * 0.6 + xt_valueNoise(xt_seeded(p * 7.0 + 13.1, $seed)) * 0.4;
  float specks = step(0.985, xt_valueNoise(xt_seeded(p * 60.0, $seed)));
  return clamp(smoothstep(0.45, 0.9, smudge) + specks, 0.0, 1.0);
}

vec4 $main(vec4 color, vec2 uv) {
  vec3 flare = texture($flare, uv).rgb;
  vec2 fromCenter = (uv - 0.5) * vec2(xt_resolution.x / xt_resolution.y, 1.0);
  float angle = atan(fromCenter.y, fromCenter.x);
  float star = 0.5 + 0.5 * cos(angle * 8.0) * cos(angle * 3.0 + 1.3);
  float modulation = mix(1.0, 0.4 + star * 1.2, $starburst) * (1.0 + $dirt(uv) * $dirtAmount * 3.0);
  return vec4(color.rgb + flare * $intensity * modulation, color.a);
}
