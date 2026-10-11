/**
 * Higher-order texture reconstruction from bilinear taps: a cubic B-spline
 * from four taps (Sigg and Hadwiger, GPU Gems 2 ch. 20) and Catmull-Rom from
 * nine.
 */

/// Cubic B-spline reconstruction from four bilinear taps; smoother than bilinear when magnifying.
vec4 xt_textureBicubic(sampler2D source, vec2 uv) {
  vec2 size = vec2(textureSize(source, 0));
  vec2 p = uv * size - 0.5;
  vec2 f = fract(p);
  p -= f;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 s0 = w0 + w1;
  vec2 s1 = w2 + w3;
  vec2 t0 = (p - 0.5 + w1 / s0) / size;
  vec2 t1 = (p + 1.5 + w3 / s1) / size;
  return (texture(source, vec2(t0.x, t0.y)) * s0.x + texture(source, vec2(t1.x, t0.y)) * s1.x) * s0.y +
    (texture(source, vec2(t0.x, t1.y)) * s0.x + texture(source, vec2(t1.x, t1.y)) * s1.x) * s1.y;
}

/// Catmull-Rom reconstruction from nine bilinear taps: sharp, passes through the texel values.
vec4 xt_textureCatmullRom(sampler2D source, vec2 uv) {
  vec2 size = vec2(textureSize(source, 0));
  vec2 p = uv * size;
  vec2 c = floor(p - 0.5) + 0.5;
  vec2 f = p - c;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 o12 = w2 / w12;
  vec2 t0 = (c - 1.0) / size;
  vec2 t3 = (c + 2.0) / size;
  vec2 t12 = (c + o12) / size;
  return (texture(source, vec2(t0.x, t0.y)) * w0.x + texture(source, vec2(t12.x, t0.y)) * w12.x + texture(source, vec2(t3.x, t0.y)) * w3.x) * w0.y +
    (texture(source, vec2(t0.x, t12.y)) * w0.x + texture(source, vec2(t12.x, t12.y)) * w12.x + texture(source, vec2(t3.x, t12.y)) * w3.x) * w12.y +
    (texture(source, vec2(t0.x, t3.y)) * w0.x + texture(source, vec2(t12.x, t3.y)) * w12.x + texture(source, vec2(t3.x, t3.y)) * w3.x) * w3.y;
}
