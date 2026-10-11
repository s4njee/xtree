// Wireframe glow: lines along every triangle edge from barycentric coordinates, a constant width on screen thanks to derivatives, over a faint fill.
vec4 $fragment(vec4 color, XtSurface surface) {
  vec3 b = surface.barycentric;
  // Without barycentrics (geometry not prepared with withBarycentric), show the fill only.
  if (b == vec3(0.0)) return vec4(mix(color.rgb, $fillColor, $fillOpacity), color.a);
  vec3 width = fwidth(b) * $thickness;
  vec3 edge3 = smoothstep(width * 0.5, width * 1.5, b);
  float line = 1.0 - min(min(edge3.x, edge3.y), edge3.z);
  // Fade lines on faces seen edge-on, where they would crowd together.
  float facing = abs(dot(surface.viewNormal, surface.viewDirection));
  line *= mix(1.0, smoothstep(0.0, 0.3, facing), $fadeGrazing);
  vec3 base = mix(color.rgb, $fillColor, $fillOpacity);
  if ($hideFill) base = vec3(0.0);
  return vec4(base + $lineColor * line * $glow, color.a);
}
