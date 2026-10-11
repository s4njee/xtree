// Screen-space rim light: lights the edges of objects whose normals turn away from the camera, strongest where they stand in front of something far away, like a backlight.
vec4 $main(vec4 color, vec2 uv) {
  vec3 n = xt_viewNormal(uv);
  if (n == vec3(0.0)) return color;
  float rim = pow(clamp(1.0 - abs(n.z), 0.0, 1.0), $width);
  // Backlight: brighter where the surface is in front of distant background.
  float depth = xt_viewDepth(uv);
  vec2 outward = normalize(n.xy + 1e-5) * xt_texel * 6.0;
  // A silhouette is where depth breaks from the surface's own slope. 1 / depth changes linearly across a plane on screen, so compare the step outward with the step inward in that space: equal on a floor, very different at an edge against something far behind.
  float inner = xt_depth(uv - outward) >= 1.0 ? 0.0 : 1.0 / xt_viewDepth(uv - outward);
  float outer = xt_depth(uv + outward) >= 1.0 ? 0.0 : 1.0 / xt_viewDepth(uv + outward);
  float center = 1.0 / max(depth, 1e-3);
  float jump = ((center - outer) - (inner - center)) / center;
  float separation = smoothstep(0.1, 0.5, jump);
  // Light from one side if asked: the rim faces the light direction.
  vec2 light = vec2(cos(radians($angle)), sin(radians($angle)));
  float side = mix(1.0, clamp(dot(normalize(n.xy + 1e-5), light) * 0.5 + 0.5, 0.0, 1.0), $directional);
  float strength = rim * mix(1.0, separation, $backlight) * side;
  return vec4(color.rgb + $color * strength * $intensity, color.a);
}
