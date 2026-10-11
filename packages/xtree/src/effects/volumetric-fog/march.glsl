precision highp float;
#include <xtree/depth/reconstruct>
#include <xtree/noise/value>
uniform sampler2D depthBuffer;
uniform mat4 inverseProjection;
uniform mat4 cameraWorld;
uniform float density;
uniform float height;
uniform float falloff;
uniform float maxDistance;
uniform float noiseAmount;
uniform float noiseScale;
uniform vec3 wind;
uniform float time;
uniform vec3 lightDirection;
uniform float anisotropy;
uniform int steps;
uniform int seed;
in vec2 vUv;
out vec4 fragColor;

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

float valueNoise3(vec3 p) {
  // Two value-noise slices blended along z: cheap 3D noise for drifting fog.
  float z = floor(p.z);
  float f = fract(p.z);
  f = f * f * (3.0 - 2.0 * f);
  return mix(xt_valueNoise(xt_seeded(p.xy + z * 17.31, seed)), xt_valueNoise(xt_seeded(p.xy + (z + 1.0) * 17.31, seed)), f);
}

float fogDensity(vec3 p) {
  float d = density * exp(-max(p.y - height, 0.0) * falloff);
  if (noiseAmount > 0.0) {
    vec3 q = p * noiseScale - wind * time;
    float n = valueNoise3(q) * 0.65 + valueNoise3(q * 2.3) * 0.35;
    d *= max(0.0, 1.0 + (n - 0.5) * 2.0 * noiseAmount);
  }
  return d;
}

// Henyey–Greenstein phase: how much light scatters toward the viewer.
float phase(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (12.5663706 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// Ray-marched height fog: transmittance and in-scattered light from the camera to the scene (or to the maximum distance).
void main() {
  float depth = texture(depthBuffer, vUv).r;
  vec3 viewEnd = xt_viewPositionFromDepth(vUv, depth >= 1.0 ? 0.999999 : depth, inverseProjection);
  vec3 origin = (cameraWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 end = (cameraWorld * vec4(viewEnd, 1.0)).xyz;
  vec3 ray = end - origin;
  float distance = min(length(ray), maxDistance);
  vec3 dir = normalize(ray);
  float stepLength = distance / float(steps);
  // A per-pixel start offset trades banding for noise, which the upsample softens.
  float t = stepLength * ign(gl_FragCoord.xy);
  float transmittance = 1.0;
  float scattered = 0.0;
  // Relative to isotropic scattering, capped so a strong forward peak glows instead of blowing out.
  float ph = min(phase(dot(dir, -normalize(lightDirection)), anisotropy) * 12.5663706, 4.0);
  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    float d = fogDensity(origin + dir * t);
    float absorbed = exp(-d * stepLength);
    // Energy-conserving integration of in-scattering over the step (Hillaire, 2015).
    scattered += transmittance * (1.0 - absorbed) * mix(1.0, ph, 0.7);
    transmittance *= absorbed;
    t += stepLength;
  }
  fragColor = vec4(vec3(scattered), transmittance);
}
