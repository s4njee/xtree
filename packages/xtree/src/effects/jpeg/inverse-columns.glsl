precision highp float;
uniform sampler2D coefficients;
in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265;

float c(float k) {
  return k == 0.0 ? 0.70710678 : 1.0;
}

// The inverse column transform: this texel holds row y of the block for coefficient column u = x.
void main() {
  vec2 pixel = floor(gl_FragCoord.xy);
  vec2 local = mod(pixel, 8.0);
  vec2 origin = pixel - local;
  vec2 texel = 1.0 / vec2(textureSize(coefficients, 0));
  vec3 sum = vec3(0.0);
  for (int v = 0; v < 8; v++) {
    vec3 f = texture(coefficients, (vec2(pixel.x, origin.y + float(v)) + 0.5) * texel).rgb;
    sum += c(float(v)) * f * cos((2.0 * local.y + 1.0) * float(v) * PI / 16.0);
  }
  fragColor = vec4(sum, 1.0);
}
