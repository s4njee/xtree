precision highp float;
#include <xtree/sampling/pyramid>
uniform sampler2D source;
uniform vec2 texel;
uniform bool prefilter;
uniform float threshold;
uniform float knee;
// Selective bloom: limits the first level to masked pixels.
uniform bool useMask;
uniform bool maskOnly;
uniform sampler2D mask;
uniform int maskChannel;
uniform bool maskInvert;
in vec2 vUv;
out vec4 fragColor;

// Soft-knee threshold: a quadratic ramp of width threshold * knee around the threshold.
vec3 bloomPrefilter(vec3 c) {
  float brightness = max(c.r, max(c.g, c.b));
  float k = threshold * knee + 1e-5;
  float soft = clamp(brightness - threshold + k, 0.0, 2.0 * k);
  soft = soft * soft / (4.0 * k);
  return c * (max(soft, brightness - threshold) / max(brightness, 1e-5));
}

vec3 tap(vec2 offset) {
  vec2 uv = vUv + offset * texel;
  vec3 c = min(texture(source, uv).rgb, vec3(65000.0));
  if (!prefilter) return c;
  if (useMask) {
    float m = texture(mask, uv)[maskChannel];
    m = maskInvert ? 1.0 - m : m;
    return maskOnly ? c * m : bloomPrefilter(c) * m;
  }
  return bloomPrefilter(c);
}

float karis(vec3 c) {
  return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722)));
}

// 13-tap downsample (Jimenez, SIGGRAPH 2014). The first level uses a Karis
// average of the five 2x2 groups to suppress fireflies.
void main() {
  vec3 a = tap(vec2(-2.0, 2.0));
  vec3 b = tap(vec2(0.0, 2.0));
  vec3 c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0));
  vec3 e = tap(vec2(0.0, 0.0));
  vec3 f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0));
  vec3 h = tap(vec2(0.0, -2.0));
  vec3 i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0));
  vec3 k = tap(vec2(1.0, 1.0));
  vec3 l = tap(vec2(-1.0, -1.0));
  vec3 m = tap(vec2(1.0, -1.0));
  vec3 result;
  if (prefilter) {
    vec3 g0 = (j + k + l + m) * 0.25;
    vec3 g1 = (a + b + d + e) * 0.25;
    vec3 g2 = (b + c + e + f) * 0.25;
    vec3 g3 = (d + e + g + h) * 0.25;
    vec3 g4 = (e + f + h + i) * 0.25;
    float w0 = karis(g0) * 0.5;
    float w1 = karis(g1) * 0.125;
    float w2 = karis(g2) * 0.125;
    float w3 = karis(g3) * 0.125;
    float w4 = karis(g4) * 0.125;
    result = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  } else {
    result = xt_downsample13(source, vUv, texel);
  }
  fragColor = vec4(max(result, 0.0), 1.0);
}
