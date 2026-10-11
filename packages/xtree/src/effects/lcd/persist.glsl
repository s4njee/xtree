precision highp float;
uniform sampler2D current;
uniform sampler2D previous;
uniform float persistence;
uniform bool first;
in vec2 vUv;
out vec4 fragColor;

// Slow pixel response: each frame moves only part of the way toward the new image.
// Written as an offset so an unchanged image stays exactly unchanged.
void main() {
  // Exact texels: filtered reads would blur the history a little every frame.
  ivec2 texel = ivec2(gl_FragCoord.xy);
  vec3 now = texelFetch(current, texel, 0).rgb;
  vec3 lag = first ? vec3(0.0) : texelFetch(previous, texel, 0).rgb - now;
  fragColor = vec4(now + lag * persistence, 1.0);
}
