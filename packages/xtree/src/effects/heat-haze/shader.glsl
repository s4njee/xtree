// Heat haze: rising, shimmering refraction from animated noise, stronger toward the bottom of the frame by default.
#include <xtree/noise/simplex>

vec4 $main(vec4 color, vec2 uv) {
  vec2 p = uv * xt_resolution / $scale;
  float t = xt_time * $speed;
  vec2 offset = vec2(
    xt_simplex(vec3(p * vec2(1.0, 0.6) - vec2(0.0, t), t * 0.3)),
    xt_simplex(vec3(p * vec2(1.0, 0.6) - vec2(0.0, t) + 17.0, t * 0.3))
  );
  float falloff = mix(1.0, 1.0 - uv.y, $rise);
  return xt_sample(uv + offset * $strength * falloff / xt_resolution);
}
