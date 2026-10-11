precision highp float;
#include <xtree/sampling/pyramid>
uniform sampler2D source;
uniform vec2 texel;
uniform float offset;
in vec2 vUv;
out vec4 fragColor;

// One Kawase iteration: four diagonal taps at a growing offset.
void main() {
  fragColor = vec4(xt_kawase(source, vUv, texel, offset), 1.0);
}
