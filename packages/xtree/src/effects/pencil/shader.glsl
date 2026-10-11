// Pencil sketch: contour lines from the depth and normal buffers and from image edges, tone from diagonal pencil strokes that thicken in shadow, on grainy paper.
#include <xtree/color/space>
#include <xtree/noise/value>

float $luma(vec2 uv) {
  return dot(clamp(xt_linearToSrgb(max(xt_sample(uv).rgb, 0.0)), 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
}

float $contour(vec2 uv) {
  vec2 t = xt_texel * $lineWidth;
  // Geometry: changes in normal direction and jumps in depth.
  vec3 n = xt_viewNormal(uv);
  float normals = 0.0;
  normals += 1.0 - dot(n, xt_viewNormal(uv + vec2(t.x, 0.0)));
  normals += 1.0 - dot(n, xt_viewNormal(uv + vec2(0.0, t.y)));
  float depth = xt_viewDepth(uv);
  float jump = abs(xt_viewDepth(uv + vec2(t.x, 0.0)) - depth) + abs(xt_viewDepth(uv + vec2(0.0, t.y)) - depth);
  float geometry = max(smoothstep(0.15, 0.4, normals), smoothstep(0.05, 0.2, jump / max(depth, 1e-3)));
  // Image: brightness edges, for texture and markings.
  float gx = $luma(uv + vec2(t.x, 0.0)) - $luma(uv - vec2(t.x, 0.0));
  float gy = $luma(uv + vec2(0.0, t.y)) - $luma(uv - vec2(0.0, t.y));
  float image = smoothstep(0.1, 0.3, length(vec2(gx, gy))) * $imageEdges;
  return max(geometry, image);
}

vec4 $main(vec4 color, vec2 uv) {
  vec2 p = uv * xt_resolution;
  float l = $luma(uv);
  // Strokes: short, broken diagonal lines whose coverage follows darkness.
  vec2 stroke = mat2(0.707, 0.707, -0.707, 0.707) * p;
  float lineNoise = xt_valueNoise(vec2(stroke.x * 0.6, floor(stroke.y / $strokeSpacing) * 7.1));
  float lines = smoothstep(0.35, 0.0, abs(fract(stroke.y / $strokeSpacing) - 0.5) - (1.0 - l) * 0.35);
  float shade = lines * smoothstep(0.85, 0.2, l) * (0.6 + 0.4 * lineNoise);
  float graphite = max(shade * $shading, $contour(uv));
  float grain = xt_valueNoise(p * 0.7) * 0.5 + xt_valueNoise(p * 2.3) * 0.5;
  vec3 paper = xt_linearToSrgb($paper) * (1.0 - grain * $paperGrain * 0.15);
  vec3 lead = xt_linearToSrgb($lead);
  return vec4(xt_srgbToLinear(mix(paper, lead, clamp(graphite * (0.75 + 0.25 * grain), 0.0, 1.0))), color.a);
}
