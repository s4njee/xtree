precision highp float;
uniform sampler2D source;
// Texel stride along the streak direction, scaled up each iteration.
uniform vec2 stride;
in vec2 vUv;
out vec4 fragColor;

// One iteration of a growing 1D blur: seven taps at ±1, ±2, ±3 steps with falling weights.
void main() {
  vec3 sum = texture(source, vUv).rgb * 0.25;
  sum += (texture(source, vUv + stride).rgb + texture(source, vUv - stride).rgb) * 0.2;
  sum += (texture(source, vUv + stride * 2.0).rgb + texture(source, vUv - stride * 2.0).rgb) * 0.1;
  sum += (texture(source, vUv + stride * 3.0).rgb + texture(source, vUv - stride * 3.0).rgb) * 0.075;
  fragColor = vec4(sum, 1.0);
}
