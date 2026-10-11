precision highp float;
uniform sampler2D source;
uniform vec2 size;
uniform bool subsample;
in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265;

// sRGB to JPEG's YCbCr, centered on zero.
vec3 ycbcr(vec3 rgb) {
  return vec3(
    dot(rgb, vec3(0.299, 0.587, 0.114)) - 0.5,
    dot(rgb, vec3(-0.168736, -0.331264, 0.5)),
    dot(rgb, vec3(0.5, -0.418688, -0.081312))
  );
}

vec3 encoded(vec2 cell) {
  vec3 c = texture(source, (cell + 0.5) / size).rgb;
  c = mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  return clamp(c, 0.0, 1.0);
}

// The 1D DCT of each 8-pixel row of a block: this texel holds coefficient u = x within the block.
void main() {
  vec2 pixel = floor(gl_FragCoord.xy);
  vec2 local = mod(pixel, 8.0);
  vec2 origin = pixel - local;
  vec3 sum = vec3(0.0);
  for (int x = 0; x < 8; x++) {
    vec2 cell = origin + vec2(float(x), local.y);
    vec3 value = ycbcr(encoded(cell));
    // 4:2:0 chroma: the average over each 2×2 square.
    if (subsample) {
      vec2 square = floor(cell / 2.0) * 2.0;
      vec3 average = (ycbcr(encoded(square)) + ycbcr(encoded(square + vec2(1.0, 0.0))) + ycbcr(encoded(square + vec2(0.0, 1.0))) + ycbcr(encoded(square + 1.0))) * 0.25;
      value.yz = average.yz;
    }
    sum += value * cos((2.0 * float(x) + 1.0) * local.x * PI / 16.0);
  }
  fragColor = vec4(sum, 1.0);
}
