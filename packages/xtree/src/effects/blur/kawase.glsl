precision highp float;
uniform sampler2D source;
uniform vec2 texel;
uniform float offset;
in vec2 vUv;
out vec4 fragColor;

// One Kawase iteration: four diagonal taps at a growing offset.
void main() {
  vec2 o = texel * (offset + 0.5);
  vec3 sum = texture(source, vUv + vec2(o.x, o.y)).rgb + texture(source, vUv + vec2(-o.x, o.y)).rgb +
    texture(source, vUv + vec2(o.x, -o.y)).rgb + texture(source, vUv + vec2(-o.x, -o.y)).rgb;
  fragColor = vec4(sum * 0.25, 1.0);
}
