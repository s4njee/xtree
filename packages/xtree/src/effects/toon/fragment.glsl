// Toon shading: the lit brightness snapped into flat bands (or looked up in a ramp), keeping each surface's hue, with a stepped specular spot and an optional hard rim.

float $luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec4 $fragment(vec4 color, XtSurface surface) {
  float l = $luma(max(color.rgb, 0.0));
  // Bands are even in perceived brightness, so dark scenes still get several.
  float perceived = pow(l, 1.0 / 2.2);
  float target;
  if ($mode == $mode_ramp) {
    // The baked ramp is already linear.
    target = $luma(texture($ramp, vec2(clamp(perceived, 0.0, 1.0), 0.5)).rgb);
  } else {
    // Each band takes the brightness at its middle.
    float bands = float($bands);
    float banded = (min(floor(perceived * bands), bands - 1.0) + 0.5) / bands;
    target = pow(mix(perceived, banded, $hardness), 2.2);
  }
  vec3 c = color.rgb * (target / max(l, 1e-4));
  // Specular: the brightest part of the shading becomes one flat spot.
  float spot = step($specularThreshold, perceived) * $specular;
  c = mix(c, vec3(max(1.0, l)) * $specularColor, spot);
  // Rim: a hard-edged line where the surface turns away.
  float facing = clamp(dot(surface.viewNormal, surface.viewDirection), 0.0, 1.0);
  float rim = step(1.0 - $rimWidth, 1.0 - facing) * $rim;
  c = mix(c, $rimColor, rim);
  return vec4(mix(color.rgb, c, $amount), color.a);
}
