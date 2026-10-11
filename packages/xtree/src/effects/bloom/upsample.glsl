precision highp float;
#include <xtree/sampling/pyramid>
uniform sampler2D low;
uniform sampler2D high;
uniform vec2 texel;
uniform float scatter;
in vec2 vUv;
out vec4 fragColor;

// 3x3 tent upsample of the lower mip, mixed with the current mip by `scatter`.
void main() {
  fragColor = vec4(mix(texture(high, vUv).rgb, xt_upsampleTent9(low, vUv, texel), scatter), 1.0);
}
