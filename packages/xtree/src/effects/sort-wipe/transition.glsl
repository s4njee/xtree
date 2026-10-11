// Pixel-sort wipe: a front crosses the frame, and across the band behind it each line of the next image appears sorted by brightness, as if a pixel sort were running along the direction of travel, before settling into the image itself.

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
  // This pixel's line through the band, sampled from the front backward.
  vec2 perX = dir / aspect * 2.0 * reach;
  vec2 frontUv = uv + perX * (front - x);
  vec4 colors[32];
  float keys[32];
  for (int i = 0; i < 32; i++) {
    if (i >= $samples) break;
    float t = (float(i) + 0.5) / float($samples);
    colors[i] = xt_to(frontUv - perX * $band * t);
    float key = $luma(colors[i].rgb);
    keys[i] = $reverse ? -key : key;
  }
  // The pixel at depth d shows the sample whose brightness rank matches d (ties broken by position).
  int k = int(clamp(floor(depth * float($samples)), 0.0, float($samples - 1)));
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
  // Ease in from the old image at the front and out into the new one at the back.
  vec4 color = mix(xt_from(uv), sorted, smoothstep(0.0, 0.12, depth));
  return mix(color, xt_to(uv), smoothstep(0.75, 1.0, depth));
}
