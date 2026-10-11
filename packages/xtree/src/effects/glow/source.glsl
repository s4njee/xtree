precision highp float;
uniform sampler2D source;
uniform bool useMask;
uniform sampler2D mask;
uniform int maskChannel;
uniform bool maskInvert;
uniform float threshold;
in vec2 vUv;
out vec4 fragColor;

// Glow source: the mask, or a soft threshold on brightness when there is none.
void main() {
  float value;
  if (useMask) {
    value = texture(mask, vUv)[maskChannel];
    value = maskInvert ? 1.0 - value : value;
  } else {
    vec3 c = texture(source, vUv).rgb;
    float brightness = max(c.r, max(c.g, c.b));
    value = smoothstep(threshold * 0.8, threshold * 1.2 + 1e-4, brightness);
  }
  fragColor = vec4(vec3(value), 1.0);
}
