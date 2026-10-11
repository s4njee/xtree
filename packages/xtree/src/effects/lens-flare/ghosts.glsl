precision highp float;
uniform sampler2D bright;
uniform int ghosts;
uniform float spacing;
uniform float halo;
uniform float haloWidth;
uniform float chromatic;
uniform float aspect;
in vec2 vUv;
out vec4 fragColor;

// Samples three channels slightly apart along a direction, for lens-like color fringes.
vec3 fringed(vec2 uv, vec2 direction) {
  vec2 d = direction * chromatic;
  return vec3(texture(bright, uv + d).r, texture(bright, uv).g, texture(bright, uv - d).b);
}

// Ghosts and a halo (Chapman, "Pseudo Lens Flare"): bright spots mirrored through the frame center.
void main() {
  vec2 uv = 1.0 - vUv;
  vec2 ghostVector = (0.5 - uv) * spacing;
  vec2 direction = normalize(ghostVector + 1e-6);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= ghosts) break;
    vec2 offset = fract(uv + ghostVector * float(i));
    // Fade ghosts toward the edges, where real ones fall off the lens.
    float weight = pow(1.0 - clamp(length(0.5 - offset) / 0.7071, 0.0, 1.0), 10.0);
    sum += fringed(offset, direction) * weight;
  }
  // A ring around the center, corrected for aspect so it stays round.
  vec2 haloVector = normalize((0.5 - uv) * vec2(aspect, 1.0) + 1e-6) / vec2(aspect, 1.0) * haloWidth;
  vec2 haloUv = uv + haloVector;
  float haloWeight = pow(1.0 - clamp(length((0.5 - fract(haloUv)) * vec2(aspect, 1.0)) / 0.7071, 0.0, 1.0), 5.0);
  sum += fringed(haloUv, direction) * haloWeight * halo;
  fragColor = vec4(sum, 1.0);
}
