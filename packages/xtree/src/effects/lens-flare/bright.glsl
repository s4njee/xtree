precision highp float;
uniform sampler2D source;
uniform vec2 texel;
uniform float threshold;
in vec2 vUv;
out vec4 fragColor;

// Quarter-resolution bright pass: a 4-tap box over the source with a soft threshold.
void main() {
  vec3 c = vec3(0.0);
  c += texture(source, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture(source, vUv + texel * vec2(1.0, -1.0)).rgb;
  c += texture(source, vUv + texel * vec2(-1.0, 1.0)).rgb;
  c += texture(source, vUv + texel * vec2(1.0, 1.0)).rgb;
  c = min(c * 0.25, vec3(64.0));
  float brightness = max(c.r, max(c.g, c.b));
  fragColor = vec4(c * max(brightness - threshold, 0.0) / max(brightness, 1e-4), 1.0);
}
