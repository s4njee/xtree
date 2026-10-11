// HUD grid: a holographic overlay of grid lines, corner brackets and a scan sweep in the accent color, fading toward the edges.
float $line(float x, float width) {
  float d = abs(fract(x + 0.5) - 0.5);
  return 1.0 - smoothstep(width * 0.5, width * 0.5 + fwidth(x), d);
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 px = uv * xt_resolution;
  vec2 cellUv = px / $gridSize;
  float lineWidth = 1.0 / $gridSize;
  float grid = max($line(cellUv.x, lineWidth), $line(cellUv.y, lineWidth));
  // Brighter major lines every fourth cell.
  float major = max($line(cellUv.x / 4.0, lineWidth / 4.0 * 1.5), $line(cellUv.y / 4.0, lineWidth / 4.0 * 1.5));
  // Corner brackets around the frame.
  vec2 edge = min(px, xt_resolution - px);
  float bracketSize = min(xt_resolution.x, xt_resolution.y) * 0.08;
  float inset = bracketSize * 0.4;
  vec2 b = edge - inset;
  float bracket = (step(0.0, b.x) * step(b.x, 2.0) * step(0.0, b.y) * step(b.y, bracketSize))
    + (step(0.0, b.y) * step(b.y, 2.0) * step(0.0, b.x) * step(b.x, bracketSize));
  // A scan sweeping down the frame. It lights up the grid lines it crosses with only a faint glow between them, so no large area changes brightness at once (WCAG 2.3.1).
  float sweepY = 1.0 - fract(xt_time * $sweepSpeed * 0.25);
  float band = smoothstep(0.15, 0.0, abs(uv.y - sweepY)) * $sweep;
  // Fade toward the edges so the overlay frames the content.
  vec2 center = abs(uv - 0.5) * 2.0;
  float vignette = 1.0 - smoothstep(1.0 - $fade, 1.0, max(center.x, center.y)) * $fade;
  float lines = (grid * 0.35 + major * 0.5) * vignette;
  float alpha = lines * ($intensity + band * 2.0) + clamp(bracket, 0.0, 1.0) * $intensity + band * 0.03;
  return vec4(color.rgb + $color * alpha, color.a);
}
