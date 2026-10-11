precision highp float;
uniform sampler2D rows;
uniform float scale;
in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265;
// The standard JPEG quantization tables (ITU-T T.81, Annex K), row-major by v then u.
const float luma[64] = float[](
  16.0, 11.0, 10.0, 16.0, 24.0, 40.0, 51.0, 61.0,
  12.0, 12.0, 14.0, 19.0, 26.0, 58.0, 60.0, 55.0,
  14.0, 13.0, 16.0, 24.0, 40.0, 57.0, 69.0, 56.0,
  14.0, 17.0, 22.0, 29.0, 51.0, 87.0, 80.0, 62.0,
  18.0, 22.0, 37.0, 56.0, 68.0, 109.0, 103.0, 77.0,
  24.0, 35.0, 55.0, 64.0, 81.0, 104.0, 113.0, 92.0,
  49.0, 64.0, 78.0, 87.0, 103.0, 121.0, 120.0, 101.0,
  72.0, 92.0, 95.0, 98.0, 112.0, 100.0, 103.0, 99.0
);
const float chroma[64] = float[](
  17.0, 18.0, 24.0, 47.0, 99.0, 99.0, 99.0, 99.0,
  18.0, 21.0, 26.0, 66.0, 99.0, 99.0, 99.0, 99.0,
  24.0, 26.0, 56.0, 99.0, 99.0, 99.0, 99.0, 99.0,
  47.0, 66.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0,
  99.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0,
  99.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0,
  99.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0,
  99.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0, 99.0
);

float c(float k) {
  return k == 0.0 ? 0.70710678 : 1.0;
}

// The column DCT completes the 2D coefficient F(u, v), which is then quantized like a JPEG encoder at the chosen quality.
void main() {
  vec2 pixel = floor(gl_FragCoord.xy);
  vec2 local = mod(pixel, 8.0);
  vec2 origin = pixel - local;
  vec2 texel = 1.0 / vec2(textureSize(rows, 0));
  vec3 sum = vec3(0.0);
  for (int y = 0; y < 8; y++) {
    vec3 row = texture(rows, (vec2(pixel.x, origin.y + float(y)) + 0.5) * texel).rgb;
    sum += row * cos((2.0 * float(y) + 1.0) * local.y * PI / 16.0);
  }
  // In units of 8-bit levels, as JPEG quantizes them.
  vec3 coefficient = sum * c(local.x) * c(local.y) * 0.25 * 255.0;
  int index = int(local.y) * 8 + int(local.x);
  vec3 quantum = max(floor(vec3(luma[index], chroma[index], chroma[index]) * scale + 0.5), 1.0);
  fragColor = vec4(floor(coefficient / quantum + 0.5) * quantum / 255.0, 1.0);
}
