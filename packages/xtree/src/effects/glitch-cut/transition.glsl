// Glitch cut: blocks jump to the next image one by one around the middle, while slices shift and color channels split. Everything scales with an envelope that is zero at both ends, and blocks switch at staggered moments rather than all at once, so the frame never flashes as a whole.
#include <xtree/noise/hash>

vec4 $transition(vec2 uv, float progress) {
  vec2 size = xt_size();
  float envelope = sin(3.14159265 * progress);
  envelope *= envelope;
  // Horizontal slices shift sideways, re-rolled in a few steps across the cut.
  float phase = floor(progress * float($steps));
  float slice = floor(uv.y * $slices);
  vec2 sliceHash = xt_hash2(vec2(slice, phase));
  float shift = (sliceHash.x - 0.5) * 2.0 * $shift * envelope * step(1.0 - $density, sliceHash.y);
  vec2 st = vec2(fract(uv.x + shift), uv.y);
  // Blocks switch to the next image at their own moment, spread around the middle.
  vec2 block = floor(uv * size / $blockSize);
  float when = 0.5 + (xt_hash1(block + 7.3) - 0.5) * $spread;
  bool switched = progress >= when;
  // Channels split horizontally.
  vec2 split = vec2($split * envelope / size.x, 0.0);
  vec4 c;
  if (switched) {
    c = vec4(xt_to(st + split).r, xt_to(st).g, xt_to(st - split).b, xt_to(st).a);
  } else {
    c = vec4(xt_from(st + split).r, xt_from(st).g, xt_from(st - split).b, xt_from(st).a);
  }
  return c;
}
