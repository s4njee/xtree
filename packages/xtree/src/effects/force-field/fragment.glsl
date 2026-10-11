// Force field: a translucent energy shell with a glowing rim, a hexagon lattice, ripples from the last hit, and a bright line where it cuts through other geometry (when given the scene's depth).
#include <xtree/depth/reconstruct>

// Distance to the nearest hexagon edge in a lattice of unit cells (0 on the edge, 0.5 at a center).
float $hexEdge(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  q = abs(q);
  return 0.5 - max(dot(q, s * 0.5), q.x);
}

vec4 $fragment(vec4 color, XtSurface surface) {
  float facing = clamp(abs(dot(surface.viewNormal, surface.viewDirection)), 0.0, 1.0);
  float rim = pow(1.0 - facing, $rimPower);
  // Hexagons on a sphere-like projection of the object position.
  vec3 d = normalize(surface.objectPosition);
  vec2 sphere = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5);
  vec2 hexUv = sphere * vec2(2.0, 1.0) * $hexScale;
  float edge = 1.0 - smoothstep(0.0, 0.06, $hexEdge(hexUv));
  // Ripples spread from the hit point and fade.
  float since = $time - $hitTime;
  float ripple = 0.0;
  if (since >= 0.0 && since < 4.0) {
    float dist = distance(surface.objectPosition, $hitPoint);
    float ring = exp(-pow((dist - since * $rippleSpeed) / 0.08, 2.0));
    ripple = ring * exp(-since * 1.5) * $rippleStrength;
  }
  // The hexagons light up near the rim and around a ripple.
  float lattice = edge * (0.15 + rim + ripple * 2.0) * $hexIntensity;
  float intersection = 0.0;
#if $has_sceneDepth
  // Where the shell is close in depth to the scene behind it, it is cutting through something.
  vec2 screen = gl_FragCoord.xy / vec2(textureSize($sceneDepth, 0));
  float sceneZ = xt_perspectiveDepthToViewZ(texture($sceneDepth, screen).r, $cameraNear, $cameraFar);
  float gap = abs(sceneZ - surface.viewPosition.z);
  intersection = 1.0 - smoothstep(0.0, $intersectionWidth, gap);
#endif
  float glow = (rim + lattice + ripple + intersection * 2.0 + $fill) * $intensity;
  return vec4($color * glow, 1.0);
}
