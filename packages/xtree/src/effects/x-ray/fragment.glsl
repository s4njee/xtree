// X-ray: the surface becomes a see-through shell of light, brightest at its edges, drawn over (or only behind) whatever hides it.
vec4 $fragment(vec4 color, XtSurface surface) {
  float facing = clamp(abs(dot(surface.viewNormal, surface.viewDirection)), 0.0, 1.0);
  float edge = pow(1.0 - facing, $edgePower);
  float glow = mix($fill, 1.0, edge) * $intensity;
  return vec4($color * glow, 1.0);
}
