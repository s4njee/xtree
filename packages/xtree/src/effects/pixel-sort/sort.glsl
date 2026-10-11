precision highp float;
uniform sampler2D source;
uniform int iteration;
uniform bool vertical;
uniform bool reverse;
uniform int key;
uniform float low;
uniform float high;
in vec2 vUv;
out vec4 fragColor;

// Perceived lightness: the image is linear, so thresholds on raw luminance would crowd into the shadows.
float lightness(vec3 c) {
  return pow(dot(clamp(c, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722)), 1.0 / 2.2);
}

float sortKey(vec3 c) {
  vec3 e = clamp(c, 0.0, 1.0);
  if (key == 1) {
    // Hue in turns.
    float maxC = max(e.r, max(e.g, e.b));
    float minC = min(e.r, min(e.g, e.b));
    float d = maxC - minC;
    if (d < 1e-5) return 0.0;
    float h = maxC == e.r ? mod((e.g - e.b) / d, 6.0) : maxC == e.g ? (e.b - e.r) / d + 2.0 : (e.r - e.g) / d + 4.0;
    return h / 6.0;
  }
  return lightness(e);
}

// Brightness decides which pixels take part: only pixels between the low and high thresholds sort, so the rest act as span boundaries.
bool sortable(vec3 c) {
  float l = lightness(c);
  return l >= low && l <= high;
}

// One step of odd–even transposition sort along the rows (or columns): neighboring pairs swap when out of order.
void main() {
  ivec2 size = textureSize(source, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  int along = vertical ? p.y : p.x;
  int extent = vertical ? size.y : size.x;
  bool first = (along + iteration) % 2 == 0;
  int other = first ? along + 1 : along - 1;
  vec4 self = texelFetch(source, p, 0);
  if (other < 0 || other >= extent) { fragColor = self; return; }
  ivec2 q = vertical ? ivec2(p.x, other) : ivec2(other, p.y);
  vec4 partner = texelFetch(source, q, 0);
  if (!sortable(self.rgb) || !sortable(partner.rgb)) { fragColor = self; return; }
  float a = sortKey(self.rgb);
  float b = sortKey(partner.rgb);
  if (reverse) { a = -a; b = -b; }
  // The first of the pair keeps the smaller key, the second the larger.
  bool swap = first ? a > b : b > a;
  fragColor = swap ? partner : self;
}
