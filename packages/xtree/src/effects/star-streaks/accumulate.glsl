precision highp float;
uniform sampler2D previous;
uniform sampler2D streak;
uniform bool first;
in vec2 vUv;
out vec4 fragColor;

// Sums the lines of the star.
void main() {
  vec3 c = texture(streak, vUv).rgb;
  if (!first) c += texture(previous, vUv).rgb;
  fragColor = vec4(c, 1.0);
}
