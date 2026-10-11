// Fresnel glow: Schlick-style rim term from the view direction and the shading normal.
vec4 $fragment(vec4 color, XtSurface surface) {
  float facing = clamp(abs(dot(surface.viewNormal, surface.viewDirection)), 0.0, 1.0);
  float rim = pow(1.0 - facing, $power);
  if ($inverted) rim = pow(facing, $power);
  rim = $bias + (1.0 - $bias) * rim;
  // 0.4 Hz: slow enough to read as breathing, far from flicker rates.
  float pulse = 1.0 - $pulse * (0.5 - 0.5 * cos(6.2831853 * 0.4 * $time));
  return vec4(color.rgb + $color * rim * $intensity * pulse, color.a);
}
