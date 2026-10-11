// Pixel-sort wipe: a front crosses the frame; across the band behind it each line of the next image appears sorted by brightness along the direction of travel, before settling into the image itself.

float $luma(vec3 c) {
  return dot(clamp(c, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
}

vec4 $transition(vec2 uv, float progress) {
  vec2 size = xt_size();
  float a = radians($angle);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 aspect = vec2(size.x / size.y, 1.0);
  float reach = abs(dir.x) * aspect.x * 0.5 + abs(dir.y) * 0.5;
  // Position along the direction of travel: 0 where the front starts and 1 where it ends.
  float x = dot((uv - 0.5) * aspect, dir) / (2.0 * reach) + 0.5;
  // The front runs from 0 to 1 + the band, so both ends are exact.
  float front = progress * (1.0 + $band);
  if (x <= front - $band) return xt_to(uv);
  if (x >= front) return xt_from(uv);
  // Depth into the band: 0 at the front, 1 where the image has settled.
  float depth = (front - x) / $band;
  // The whole line through this pixel, sampled once along the direction of travel. The sorted image is fixed, not tied to the moving front, so pixels change smoothly rather than re-sorting every frame (which would flicker).
  vec2 perX = dir / aspect * 2.0 * reach;
  vec2 lineStart = uv - perX * x;
  vec4 colors[32];
  float keys[32];
  for (int i = 0; i < 32; i++) {
    if (i >= $samples) break;
    float t = (float(i) + 0.5) / float($samples);
    colors[i] = xt_to(lineStart + perX * t);
    float key = $luma(colors[i].rgb);
    keys[i] = $reverse ? -key : key;
  }
  // The pixel at position x along the line shows the sample whose brightness rank matches x (ties broken by position).
  int k = int(clamp(floor(x * float($samples)), 0.0, float($samples - 1)));
  vec4 sorted = colors[0];
  for (int i = 0; i < 32; i++) {
    if (i >= $samples) break;
    int rank = 0;
    for (int j = 0; j < 32; j++) {
      if (j >= $samples) break;
      if (keys[j] < keys[i] || (keys[j] == keys[i] && j < i)) rank++;
    }
    if (rank == k) sorted = colors[i];
  }
  // From the old image into the sorted one at the front, then into the new image at the back.
  vec4 color = mix(xt_from(uv), sorted, smoothstep(0.0, 0.4, depth));
  return mix(color, xt_to(uv), smoothstep(0.6, 1.0, depth));
}
