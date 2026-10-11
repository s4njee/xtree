// Signal loss: during a dropout the picture freezes on the last good frame (or falls to noise), torn by bands of static and blocks.
#include <xtree/noise/hash>

vec4 $main(vec4 color, vec2 uv) {
  if ($dropout < 0.5) return color;
  float line = floor(uv.y * xt_resolution.y / 3.0);
  // The damage re-rolls only twice a second, so dropouts never flicker (WCAG 2.3.1).
  float t = floor($phase * 2.0);
  vec3 held = texture($held, uv).rgb;
#if $mode == $mode_noise
  vec3 base = vec3(xt_hash1(xt_seeded(vec2(floor(uv * xt_resolution / 2.0)) + t * 13.0, $seed))) * 0.6;
#else
  vec3 base = held;
#endif
  // Bands of static and displaced blocks over the frozen picture.
  float band = step(0.82, xt_hash1(xt_seeded(vec2(line, t), $seed)));
  vec2 block = floor(uv * vec2(12.0, 8.0));
  float blocky = step(0.9, xt_hash1(xt_seeded(block + t * 7.0, $seed)));
  vec3 staticNoise = vec3(xt_hash1(xt_seeded(vec2(floor(uv * xt_resolution)) + t, $seed))) * 0.5;
  vec3 c = mix(base, staticNoise, band * $severity);
  c = mix(c, texture($held, fract(uv + vec2(0.1, 0.0))).rgb, blocky * $severity);
  // Freeze frames lose some color, as decoders show them.
  c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), 0.3 * $severity);
  return vec4(c, color.a);
}
