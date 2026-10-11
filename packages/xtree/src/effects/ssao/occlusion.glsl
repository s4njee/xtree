precision highp float;
#include <xtree/depth/reconstruct>
uniform sampler2D depthBuffer;
uniform sampler2D normalBuffer;
uniform mat4 projection;
uniform mat4 inverseProjection;
uniform float radius;
uniform float bias;
uniform int samples;
in vec2 vUv;
out vec4 fragColor;

// Interleaved gradient noise (Jimenez, 2014): a per-pixel rotation that the blur pass then averages out.
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

vec3 viewPosition(vec2 uv) {
  return xt_viewPositionFromDepth(uv, texture(depthBuffer, uv).r, inverseProjection);
}

// Normal-oriented hemisphere occlusion: samples spread through a hemisphere around the normal count as occluded when the scene in front of them is nearer to the camera, weighted down when the occluder is far outside the radius.
void main() {
  float depth = texture(depthBuffer, vUv).r;
  vec4 encoded = texture(normalBuffer, vUv);
  if (depth >= 1.0 || encoded.a == 0.0) {
    fragColor = vec4(1.0);
    return;
  }
  vec3 p = viewPosition(vUv);
  vec3 n = normalize(encoded.xyz * 2.0 - 1.0);
  float angle = ign(gl_FragCoord.xy) * 6.2831853;
  vec3 random = vec3(cos(angle), sin(angle), 0.0);
  vec3 t = normalize(random - n * dot(random, n));
  mat3 tbn = mat3(t, cross(n, t), n);
  float occlusion = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= samples) break;
    // A Fibonacci spiral over the hemisphere, denser near the center.
    float fi = float(i) + 0.5;
    float z = 1.0 - fi / float(samples);
    float r = sqrt(1.0 - z * z);
    float phi = fi * 2.39996323;
    vec3 dir = vec3(cos(phi) * r, sin(phi) * r, z);
    float scale = mix(0.1, 1.0, (fi / float(samples)) * (fi / float(samples)));
    vec3 s = p + tbn * dir * radius * scale;
    vec4 clip = projection * vec4(s, 1.0);
    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) continue;
    float sceneZ = viewPosition(uv).z;
    float range = smoothstep(0.0, 1.0, radius / max(abs(p.z - sceneZ), 1e-4));
    occlusion += (sceneZ >= s.z + bias ? 1.0 : 0.0) * range;
  }
  fragColor = vec4(vec3(1.0 - occlusion / float(samples)), 1.0);
}
