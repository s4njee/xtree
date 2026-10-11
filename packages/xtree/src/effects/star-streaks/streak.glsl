precision highp float;
uniform sampler2D source;
uniform vec2 stride;
uniform float attenuation;
in vec2 vUv;
out vec4 fragColor;

// Kawase's star filter: four taps each way along a line, weights falling geometrically; repeated with a growing stride.
void main() {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    float w = pow(attenuation, float(i));
    sum += (texture(source, vUv + stride * float(i)).rgb + texture(source, vUv - stride * float(i)).rgb) * w;
    total += 2.0 * w;
  }
  fragColor = vec4(sum / total, 1.0);
}
