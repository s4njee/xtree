precision highp float;
#include <xtree/depth/reconstruct>
uniform sampler2D source;
uniform sampler2D depthBuffer;
uniform float near;
uniform float far;
uniform bool ortho;
uniform vec2 direction;
uniform float radius;
in vec2 vUv;
out vec4 fragColor;

float viewDepth(vec2 uv) {
  float d = texture(depthBuffer, uv).r;
  return -(ortho ? xt_orthographicDepthToViewZ(d, near, far) : xt_perspectiveDepthToViewZ(d, near, far));
}

// One axis of a depth-aware blur: neighbors at a different depth count less, so occlusion doesn't bleed across silhouettes.
void main() {
  vec2 texel = 1.0 / vec2(textureSize(source, 0));
  float center = viewDepth(vUv);
  float sum = 0.0;
  float total = 0.0;
  for (int i = -4; i <= 4; i++) {
    vec2 uv = vUv + direction * texel * float(i) * radius * 0.25;
    float w = exp(-float(i * i) / 8.0) * exp(-abs(viewDepth(uv) - center) / max(center * 0.05, 1e-3));
    sum += texture(source, uv).r * w;
    total += w;
  }
  fragColor = vec4(vec3(sum / max(total, 1e-5)), 1.0);
}
