/**
 * Cheap per-pixel dither noise. Interleaved gradient noise needs no texture
 * (Jimenez, "Next Generation Post Processing in Call of Duty: Advanced
 * Warfare", SIGGRAPH 2014). Blue-noise sampling reads a tiling texture and
 * moves it each frame along the R2 low-discrepancy sequence, so successive
 * frames are decorrelated.
 */

/// Interleaved gradient noise in [0, 1) for a pixel coordinate (for example gl_FragCoord.xy).
float xt_ign(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}

/// Interleaved gradient noise that changes every frame and repeats every 64 frames.
float xt_ign(vec2 pixel, int frame) {
  return xt_ign(pixel + 5.588238 * float(frame & 63));
}

/// Offset of the R2 sequence for a frame, in [0, 1)^2.
vec2 xt_r2(int frame) {
  return fract(float(frame) * vec2(0.754877666247, 0.569840290998));
}

/// Fetches a tiling blue-noise texture at a non-negative pixel, offset each frame along R2.
vec4 xt_blueNoise(sampler2D tex, ivec2 pixel, int frame) {
  ivec2 size = textureSize(tex, 0);
  ivec2 offset = ivec2(xt_r2(frame) * vec2(size));
  return texelFetch(tex, (pixel + offset) % size, 0);
}
