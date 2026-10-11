// Zoom / warp speed: the image rushes toward the viewer with radial streaks, and the next image arrives out of the same streaks.

vec4 $sampleZoom(vec2 uv, float scale, float streak, bool next) {
  vec2 size = xt_size();
  vec2 aspect = vec2(size.x / size.y, 1.0);
  vec2 d = (uv - $center) * aspect;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 32; i++) {
    if (i >= $samples) break;
    // Samples spread inward along the ray from the center: streaks.
    float f = float(i) / float(max($samples - 1, 1));
    vec2 st = $center + d / scale * (1.0 - streak * f) / aspect;
    sum += next ? xt_to(st) : xt_from(st);
  }
  return sum / float($samples);
}

vec4 $transition(vec2 uv, float progress) {
  // The streaks and zoom peak at the middle and vanish at both ends.
  float rise = sin(3.14159265 * progress);
  float streak = rise * $streaks;
  if (streak <= 1e-4) return progress < 0.5 ? xt_from(uv) : xt_to(uv);
  float t = smoothstep(0.35, 0.65, progress);
  // The old image grows as it leaves; the new one starts large and settles to its size.
  vec4 from = t < 1.0 ? $sampleZoom(uv, 1.0 + $zoom * progress, streak, false) : vec4(0.0);
  vec4 to = t > 0.0 ? $sampleZoom(uv, 1.0 + $zoom * (1.0 - progress) * 0.5, streak, true) : vec4(0.0);
  vec4 color = mix(from, to, t);
  // A white-hot flash at the center reads as speed without flashing the frame.
  color.rgb += vec3(rise * rise * $flare) * exp(-length((uv - $center) * vec2(xt_size().x / xt_size().y, 1.0)) * 6.0);
  return color;
}
