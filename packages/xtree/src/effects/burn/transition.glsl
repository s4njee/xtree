// Burn: the image chars and burns away in noisy patches along a glowing edge in the theme accent, revealing the next image underneath.
#include <xtree/noise/fbm>

vec4 $transition(vec2 uv, float progress) {
  vec2 size = xt_size();
  vec2 p = uv * vec2(size.x / size.y, 1.0);
  // When this pixel burns, in [0, 1]: noise, optionally biased toward one side.
  // fBm clusters near zero (its spread is about 0.18), so a logistic stand-in for its CDF spreads the burn evenly over the transition instead of most of the frame catching at once (WCAG 2.3.1).
  float n = 1.0 / (1.0 + exp(-9.5 * xt_fbm(p * $scale, 5, 2.0, 0.5)));
  float v = clamp(mix(n, 1.0 - uv.y, $direction), 0.0, 1.0);
  // The burning edge (and the char ahead of it) moves from just before 0 to just past 1, so nothing glows or chars at either end.
  float w = $edgeWidth;
  float c = progress * (1.0 + 2.0 * w + $charWidth) - w - $charWidth;
  vec4 from = xt_from(uv);
  vec4 to = xt_to(uv);
  if (v < c - w) return to;
  if (v > c + w + $charWidth) return from;
  // Charring darkens the old image just ahead of the edge.
  float ahead = v - c;
  float char = 1.0 - smoothstep(w, w + $charWidth, ahead);
  vec4 color = from;
  color.rgb *= 1.0 - char * $charring;
  // The edge itself: a hot band from the accent color to white at its core.
  float band = 1.0 - smoothstep(0.0, w, abs(ahead));
  vec3 glow = mix(xt_accent, vec3(1.0), band * band) * band * $glow;
  // Behind the edge, the next image shows through.
  float burnt = smoothstep(w * 0.5, -w * 0.5, ahead);
  color = mix(color, to, burnt);
  color.rgb += glow;
  return color;
}
