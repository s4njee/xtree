precision highp float;
uniform sampler2D source;
uniform vec2 direction;
uniform float radius;
uniform bool box;
in vec2 vUv;
out vec4 fragColor;

// One axis of a Gaussian (sigma = radius / 3) or box blur.
void main() {
  float sigma = max(radius / 3.0, 1e-3);
  vec3 sum = texture(source, vUv).rgb;
  float total = 1.0;
  for (int i = 1; i <= 96; i++) {
    float x = float(i);
    if (x > radius) break;
    float w = box ? 1.0 : exp(-0.5 * x * x / (sigma * sigma));
    sum += (texture(source, vUv + direction * x).rgb + texture(source, vUv - direction * x).rgb) * w;
    total += 2.0 * w;
  }
  fragColor = vec4(sum / total, 1.0);
}
