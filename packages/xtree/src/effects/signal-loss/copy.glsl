precision highp float;
uniform sampler2D source;
in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = texture(source, vUv);
}
