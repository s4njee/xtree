// VHS: tape wobble, chroma bleed and shift (YIQ), a rolling tracking band, head-switching noise at the bottom, luma noise and an on-screen display.
#include <xtree/color/space>
#include <xtree/noise/hash>
#include <xtree/noise/value>

// Seven-segment glyph masks: bit 0 top, 1 top right, 2 bottom right, 3 bottom, 4 bottom left, 5 top left, 6 middle.
float $segments(int code, vec2 p) {
  float on = 0.0;
  float w = 0.12;
  // p in the glyph box: x 0–1, y 0–2.
  if ((code & 1) != 0) on = max(on, step(abs(p.y - 2.0), w) * step(0.1, p.x) * step(p.x, 0.9));
  if ((code & 2) != 0) on = max(on, step(abs(p.x - 1.0), w) * step(1.05, p.y) * step(p.y, 1.95));
  if ((code & 4) != 0) on = max(on, step(abs(p.x - 1.0), w) * step(0.05, p.y) * step(p.y, 0.95));
  if ((code & 8) != 0) on = max(on, step(abs(p.y), w) * step(0.1, p.x) * step(p.x, 0.9));
  if ((code & 16) != 0) on = max(on, step(abs(p.x), w) * step(0.05, p.y) * step(p.y, 0.95));
  if ((code & 32) != 0) on = max(on, step(abs(p.x), w) * step(1.05, p.y) * step(p.y, 1.95));
  if ((code & 64) != 0) on = max(on, step(abs(p.y - 1.0), w) * step(0.1, p.x) * step(p.x, 0.9));
  return on;
}

int $digit(int d) {
  int codes[10] = int[](63, 6, 91, 79, 102, 109, 125, 7, 127, 111);
  return codes[clamp(d, 0, 9)];
}

// "PLAY" at the top left and a tape counter (minutes:seconds) at the bottom left.
float $display(vec2 uv) {
  vec2 p = uv * xt_resolution / (xt_resolution.y * 0.025);
  float lit = 0.0;
  // PLAY: P, L, A, Y.
  int word[4] = int[](115, 56, 119, 110);
  vec2 origin = vec2(2.0, xt_resolution.y / (xt_resolution.y * 0.025) - 4.0);
  for (int i = 0; i < 4; i++) {
    vec2 q = (p - origin - vec2(float(i) * 1.6, 0.0));
    if (q.x > -0.2 && q.x < 1.2 && q.y > -0.2 && q.y < 2.2) lit = max(lit, $segments(word[i], q));
  }
  int seconds = int(xt_time);
  int counter[4] = int[]($digit((seconds / 600) % 10), $digit((seconds / 60) % 10), $digit((seconds / 10) % 6), $digit(seconds % 10));
  vec2 bottom = vec2(2.0, 2.0);
  for (int i = 0; i < 4; i++) {
    vec2 q = p - bottom - vec2(float(i) * 1.6 + (i >= 2 ? 0.8 : 0.0), 0.0);
    if (q.x > -0.2 && q.x < 1.2 && q.y > -0.2 && q.y < 2.2) lit = max(lit, $segments(counter[i], q));
  }
  // The colon between minutes and seconds.
  vec2 colon = p - bottom - vec2(3.35, 0.0);
  lit = max(lit, step(length(colon - vec2(0.0, 0.6)), 0.14) + step(length(colon - vec2(0.0, 1.4)), 0.14));
  return clamp(lit, 0.0, 1.0);
}

vec4 $main(vec4 color, vec2 uv) {
  float line = floor(uv.y * xt_resolution.y);
  // Tape wobble: slow horizontal drift that varies down the frame.
  float wobble = (sin(uv.y * 6.0 + xt_time * 1.3) * 0.6 + xt_valueNoise(xt_seeded(vec2(line * 0.02, xt_time * 2.0), $seed)) - 0.5) * $wobble * 0.004;
  // The tracking band rolls down the frame.
  float bandCenter = 1.0 - fract(xt_time * 0.08);
  float band = $tracking * smoothstep(0.06, 0.0, abs(uv.y - bandCenter));
  float jitter = (xt_hash1(xt_seeded(vec2(line, floor(xt_time * 24.0)), $seed)) - 0.5) * band * 0.04;
  // Head switching: the bottom lines of the frame skew to the right.
  float head = smoothstep(0.03, 0.0, uv.y) * $headSwitching;
  vec2 st = vec2(uv.x + wobble + jitter + head * 0.03, uv.y);
  // Chroma is band-limited and lags behind luma, so colors smear to the right.
  vec3 center = xt_rgbToYiq(xt_linearToSrgb(max(xt_sample(st).rgb, 0.0)));
  vec2 chroma = vec2(0.0);
  float weight = 0.0;
  for (int i = 0; i < 8; i++) {
    float t = float(i) / 7.0;
    float w = 1.0 - t * 0.7;
    vec3 yiq = xt_rgbToYiq(xt_linearToSrgb(max(xt_sample(st - vec2((t * $bleed + $bleed * 0.5) / xt_resolution.x, 0.0)).rgb, 0.0)));
    chroma += yiq.yz * w;
    weight += w;
  }
  vec3 yiq = vec3(center.x, chroma / weight * $saturation);
  // Luma noise and tracking specks.
  float n = xt_hash1(xt_seeded(vec2(floor(uv * xt_resolution * vec2(0.5, 1.0)) + floor(xt_time * 30.0) * 17.0), $seed)) - 0.5;
  yiq.x += n * $noise * 0.2;
  float speck = step(1.0 - band * 0.5 - head * 0.3, xt_hash1(xt_seeded(vec2(floor(uv.x * xt_resolution.x * 0.25), line + floor(xt_time * 30.0)), $seed)));
  yiq.x = mix(yiq.x, 0.95, speck);
  vec3 c = xt_yiqToRgb(yiq);
  if ($onScreenDisplay) c = mix(c, vec3(0.95), $display(uv));
  return vec4(xt_srgbToLinear(max(c, 0.0)), color.a);
}
