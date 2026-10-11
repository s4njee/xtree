precision highp float;
uniform sampler2D low;
uniform sampler2D high;
uniform vec2 texel;
uniform float scatter;
in vec2 vUv;
out vec4 fragColor;

// 3x3 tent upsample of the lower mip, mixed with the current mip by `scatter`.
void main() {
  vec3 tent =
    (texture(low, vUv + vec2(-1.0, 1.0) * texel).rgb + texture(low, vUv + vec2(1.0, 1.0) * texel).rgb +
     texture(low, vUv + vec2(-1.0, -1.0) * texel).rgb + texture(low, vUv + vec2(1.0, -1.0) * texel).rgb) * 0.0625 +
    (texture(low, vUv + vec2(0.0, 1.0) * texel).rgb + texture(low, vUv + vec2(-1.0, 0.0) * texel).rgb +
     texture(low, vUv + vec2(1.0, 0.0) * texel).rgb + texture(low, vUv + vec2(0.0, -1.0) * texel).rgb) * 0.125 +
    texture(low, vUv).rgb * 0.25;
  fragColor = vec4(mix(texture(high, vUv).rgb, tent, scatter), 1.0);
}
