precision highp float;
uniform sampler2D current;
uniform sampler2D previousInput;
uniform sampler2D previousMosh;
uniform sampler2D velocity;
uniform bool useVelocity;
uniform bool keyframe;
uniform float blockSize;
uniform float strength;
uniform float refresh;
uniform vec2 resolution;
in vec2 vUv;
out vec4 fragColor;

float luma(vec3 c) {
  return dot(min(c, vec3(4.0)), vec3(0.2126, 0.7152, 0.0722));
}

// Optical flow, lite: Lucas–Kanade over a 5×5 neighborhood of the block center, from the previous to the current input.
vec2 flow(vec2 center) {
  vec2 texel = 1.0 / resolution;
  float sxx = 0.0;
  float sxy = 0.0;
  float syy = 0.0;
  float sxt = 0.0;
  float syt = 0.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 p = center + vec2(float(i), float(j)) * texel * blockSize * 0.25;
      float ix = (luma(texture(current, p + vec2(texel.x, 0.0)).rgb) - luma(texture(current, p - vec2(texel.x, 0.0)).rgb)) * 0.5;
      float iy = (luma(texture(current, p + vec2(0.0, texel.y)).rgb) - luma(texture(current, p - vec2(0.0, texel.y)).rgb)) * 0.5;
      float it = luma(texture(current, p).rgb) - luma(texture(previousInput, p).rgb);
      sxx += ix * ix;
      sxy += ix * iy;
      syy += iy * iy;
      sxt += ix * it;
      syt += iy * it;
    }
  }
  float det = sxx * syy - sxy * sxy;
  if (abs(det) < 1e-6) return vec2(0.0);
  // In pixels per frame, converted to UV.
  vec2 v = vec2(-(syy * sxt - sxy * syt), -(sxx * syt - sxy * sxt)) / det;
  return clamp(v, -8.0, 8.0) * texel;
}

// Datamosh: without new keyframes, the previous moshed frame is pushed along each block's motion, so old pixels smear with the movement (the P-frame effect of a video missing its I-frames).
void main() {
  vec4 now = texture(current, vUv);
  if (keyframe) {
    fragColor = now;
    return;
  }
  vec2 block = (floor(vUv * resolution / blockSize) + 0.5) * blockSize / resolution;
  vec2 motion = useVelocity ? texture(velocity, block).xy : flow(block);
  vec4 moved = texture(previousMosh, vUv - motion * strength);
  fragColor = mix(moved, now, refresh);
}
