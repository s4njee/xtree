// NTSC composite: encodes each line as luma plus chroma on a 3.58 MHz subcarrier (four samples per cycle), then decodes with simple filters, which brings back the dot crawl, rainbow artifacts and soft color of composite video.
#include <xtree/color/space>

vec4 $main(vec4 color, vec2 uv) {
  float samples = $resolution;
  float x = uv.x * samples;
  float line = floor(uv.y * xt_resolution.y);
  // The subcarrier phase advances a quarter cycle per sample and flips each line (and each frame for dot crawl).
  float framePhase = $dotCrawl ? mod(floor(xt_time * 30.0), 2.0) * 3.14159265 : 0.0;
  float linePhase = mod(line, 2.0) * 3.14159265 + framePhase;
  float luma = 0.0;
  float i = 0.0;
  float q = 0.0;
  float lumaWeight = 0.0;
  float chromaWeight = 0.0;
  for (int k = -8; k <= 8; k++) {
    float sx = floor(x) + float(k);
    vec3 yiq = xt_rgbToYiq(clamp(xt_linearToSrgb(max(xt_sample(vec2((sx + 0.5) / samples, uv.y)).rgb, 0.0)), 0.0, 1.0));
    float phase = sx * 1.5707963 + linePhase;
    float signal = yiq.x + yiq.y * cos(phase) + yiq.z * sin(phase);
    // Luma: a window over a whole carrier cycle cancels most of the chroma; sharpness narrows it.
    float lw = max(0.0, 1.0 - abs(float(k)) / mix(4.0, 1.5, $sharpness));
    luma += signal * lw;
    lumaWeight += lw;
    // Chroma: demodulate by the carrier and low-pass over two cycles.
    float cw = max(0.0, 1.0 - abs(float(k)) / 8.0);
    i += signal * cos(phase) * cw;
    q += signal * sin(phase) * cw;
    chromaWeight += cw;
  }
  vec3 decoded = vec3(luma / lumaWeight, 2.0 * i / chromaWeight, 2.0 * q / chromaWeight);
  vec3 composite = xt_srgbToLinear(max(xt_yiqToRgb(decoded), 0.0));
  return vec4(mix(color.rgb, composite, $artifacts), color.a);
}
