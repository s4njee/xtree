precision highp float;
#include <xtree/depth/reconstruct>
#include <xtree/sampling/spiral>
uniform sampler2D source;
uniform sampler2D depthBuffer;
uniform float near;
uniform float far;
uniform bool ortho;
uniform int focusMode;
uniform float focusDistance;
uniform vec2 focusPoint;
uniform float focusRange;
uniform float aperture;
uniform float maxBlur;
uniform int shape;
uniform float spacing;
uniform float scale;
in vec2 vUv;
out vec4 fragColor;

float viewDepth(vec2 uv) {
  float d = texture(depthBuffer, uv).r;
  return -(ortho ? xt_orthographicDepthToViewZ(d, near, far) : xt_perspectiveDepthToViewZ(d, near, far));
}

// The same circle of confusion as the full-resolution pass, in this target's pixels.
float coc(float depth, float focus) {
  float away = max(abs(depth - focus) - 0.5 * focusRange, 0.0) / max(depth, 1e-3);
  return sign(depth - focus) * min(away * aperture, 1.0) * maxBlur * scale;
}

float shapeScale(float angle) {
  if (shape != 1) return 1.0;
  float sector = mod(angle, 1.0471976) - 0.5235988;
  return 0.8660254 / cos(sector);
}

// Depth of field at reduced resolution: the single-pass spiral gather, on fewer pixels.
void main() {
  vec2 size = vec2(textureSize(source, 0));
  vec2 texel = 1.0 / vec2(textureSize(depthBuffer, 0)) / scale;
  float focus = focusMode == 1 ? viewDepth(focusPoint) : focusDistance;
  float centerDepth = viewDepth(vUv);
  float centerSize = abs(coc(centerDepth, focus));
  vec3 sum = texture(source, vUv).rgb;
  float total = 1.0;
  float radius = spacing;
  float angle = 0.0;
  float limit = maxBlur * scale;
  for (int i = 0; i < 2048 && radius < limit; i++) {
    vec2 st = vUv + vec2(cos(angle), sin(angle)) * shapeScale(angle) * radius * texel;
    vec3 sampled = min(texture(source, st).rgb, vec3(65000.0));
    float sampleDepth = viewDepth(st);
    float sampleSize = abs(coc(sampleDepth, focus));
    if (sampleDepth > centerDepth) sampleSize = min(sampleSize, centerSize * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
    sum += mix(sum / total, sampled, m);
    total += 1.0;
    radius += spacing / radius;
    angle += XT_GOLDEN_ANGLE;
  }
  fragColor = vec4(sum / total, 1.0);
}
