// God rays: light shafts radiating from a light's position on screen, made by marching toward it and summing light that isn't blocked (Mitchell, GPU Gems 3, ch. 13).
#include <xtree/noise/hash>

vec2 $lightUv() {
  if (!$worldLight) return $position;
  vec4 view = inverse(xt_cameraWorld) * vec4($lightWorld, 1.0);
  vec4 clip = xt_projection * view;
  return clip.xy / clip.w * 0.5 + 0.5;
}

// How much light this sample lets through: bright pixels, or far background.
vec3 $source(vec2 st) {
  vec3 c = min(xt_sample(st).rgb, vec3(16.0));
  float bright = smoothstep($threshold, $threshold * 1.5 + 0.01, max(c.r, max(c.g, c.b)));
  float sky = xt_depth(st) >= 1.0 ? $skyWeight : 0.0;
  return c * bright + $color * sky * 0.2;
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 light = $lightUv();
  vec2 delta = (uv - light) * $density / float($samples);
  vec2 st = uv - delta * xt_hash1(floor(uv * xt_resolution) + 0.5);
  float illumination = 1.0;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 128; i++) {
    if (i >= $samples) break;
    st -= delta;
    sum += $source(st) * illumination * $weight;
    illumination *= $decay;
  }
  // Fade the shafts out when the light is far off screen.
  vec2 off = max(abs(light - 0.5) - 0.5, 0.0);
  float onScreen = 1.0 - smoothstep(0.0, 0.5, length(off));
  return vec4(color.rgb + sum * $color * $intensity * onScreen, color.a);
}
