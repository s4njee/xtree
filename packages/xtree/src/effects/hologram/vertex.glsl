// Hologram glitch: occasional horizontal slices jump sideways, a few times a second.
#include <xtree/noise/hash>

void $vertex(inout vec3 position, vec3 normal) {
  float frame = floor($time * 6.0);
  float slice = floor(position.y * 6.0);
  float h = xt_hash1(xt_seeded(vec2(slice, frame), $seed));
  position.x += step(0.9, h) * (h - 0.95) * 20.0 * $glitch;
}
