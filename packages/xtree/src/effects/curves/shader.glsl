// Curves: a master tone curve, then one curve per channel, each baked to a 256×1 texture and sampled at texel centers.
#include <xtree/color/space>

float $curve(sampler2D curve, float x) {
  return texture(curve, vec2(clamp(x, 0.0, 1.0) * (255.0 / 256.0) + 0.5 / 256.0, 0.5)).r;
}

vec4 $main(vec4 color, vec2 uv) {
  vec3 display = xt_linearToSrgb(max(color.rgb, 0.0));
  vec3 c = clamp(display, 0.0, 1.0);
  // The curves cover 0–1; HDR values above 1 keep their excess unchanged.
  vec3 excess = display - c;
  c = vec3($curve($master, c.r), $curve($master, c.g), $curve($master, c.b));
  c = vec3($curve($red, c.r), $curve($green, c.g), $curve($blue, c.b));
  c = mix(display, c + excess, $amount);
  return vec4(xt_srgbToLinear(max(c, 0.0)), color.a);
}
