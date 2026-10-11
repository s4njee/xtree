// JPEG artifacts: the inverse row transform of the quantized blocks, back from YCbCr to RGB.
vec4 $main(vec4 color, vec2 uv) {
  vec2 size = vec2(textureSize($blocks, 0));
  vec2 pixel = floor(uv * size);
  vec2 local = mod(pixel, 8.0);
  vec2 origin = pixel - local;
  vec3 sum = vec3(0.0);
  for (int u = 0; u < 8; u++) {
    vec3 g = texture($blocks, (vec2(origin.x + float(u), pixel.y) + 0.5) / size).rgb;
    float cu = u == 0 ? 0.70710678 : 1.0;
    sum += cu * g * cos((2.0 * local.x + 1.0) * float(u) * 3.14159265 / 16.0);
  }
  vec3 ycc = sum * 0.25;
  // Undo the centering of luma.
  ycc.x += 0.5;
  vec3 rgb = vec3(
    ycc.x + 1.402 * ycc.z,
    ycc.x - 0.344136 * ycc.y - 0.714136 * ycc.z,
    ycc.x + 1.772 * ycc.y
  );
  rgb = clamp(rgb, 0.0, 1.0);
  vec3 linear = mix(rgb / 12.92, pow((rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, rgb));
  return vec4(mix(color.rgb, linear, $amount), color.a);
}
