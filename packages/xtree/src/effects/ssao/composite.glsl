// Ambient occlusion: darkens creases and contact points by the blurred occlusion, toward the shadow color.
vec4 $main(vec4 color, vec2 uv) {
  float ao = pow(clamp(texture($occlusion, uv).r, 0.0, 1.0), $intensity);
  if ($debug) return vec4(vec3(ao), color.a);
  return vec4(color.rgb * mix($color, vec3(1.0), ao), color.a);
}
