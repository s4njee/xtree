/**
 * Pyramid and blur filters for bloom and blur: the 13-tap downsample and
 * 3×3 tent upsample from Jimenez's "Next Generation Post Processing in Call
 * of Duty: Advanced Warfare" (SIGGRAPH 2014), and Kawase taps (Kawase,
 * GDC 2003).
 */

/// 13-tap downsample to half resolution; `texel` is the source's texel size.
vec3 xt_downsample13(sampler2D source, vec2 uv, vec2 texel) {
  vec3 a = texture(source, uv + vec2(-2.0, 2.0) * texel).rgb;
  vec3 b = texture(source, uv + vec2(0.0, 2.0) * texel).rgb;
  vec3 c = texture(source, uv + vec2(2.0, 2.0) * texel).rgb;
  vec3 d = texture(source, uv + vec2(-2.0, 0.0) * texel).rgb;
  vec3 e = texture(source, uv).rgb;
  vec3 f = texture(source, uv + vec2(2.0, 0.0) * texel).rgb;
  vec3 g = texture(source, uv + vec2(-2.0, -2.0) * texel).rgb;
  vec3 h = texture(source, uv + vec2(0.0, -2.0) * texel).rgb;
  vec3 i = texture(source, uv + vec2(2.0, -2.0) * texel).rgb;
  vec3 j = texture(source, uv + vec2(-1.0, 1.0) * texel).rgb;
  vec3 k = texture(source, uv + vec2(1.0, 1.0) * texel).rgb;
  vec3 l = texture(source, uv + vec2(-1.0, -1.0) * texel).rgb;
  vec3 m = texture(source, uv + vec2(1.0, -1.0) * texel).rgb;
  return e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
}

/// 3×3 tent upsample; `texel` is the source's (lower mip's) texel size.
vec3 xt_upsampleTent9(sampler2D source, vec2 uv, vec2 texel) {
  return (texture(source, uv + vec2(-1.0, 1.0) * texel).rgb + texture(source, uv + vec2(1.0, 1.0) * texel).rgb +
    texture(source, uv + vec2(-1.0, -1.0) * texel).rgb + texture(source, uv + vec2(1.0, -1.0) * texel).rgb) * 0.0625 +
    (texture(source, uv + vec2(0.0, 1.0) * texel).rgb + texture(source, uv + vec2(-1.0, 0.0) * texel).rgb +
    texture(source, uv + vec2(1.0, 0.0) * texel).rgb + texture(source, uv + vec2(0.0, -1.0) * texel).rgb) * 0.125 +
    texture(source, uv).rgb * 0.25;
}

/// One Kawase iteration: the mean of four diagonal bilinear taps at `offset` + 0.5 texels.
vec3 xt_kawase(sampler2D source, vec2 uv, vec2 texel, float offset) {
  vec2 o = texel * (offset + 0.5);
  return (texture(source, uv + vec2(o.x, o.y)).rgb + texture(source, uv + vec2(-o.x, o.y)).rgb +
    texture(source, uv + vec2(o.x, -o.y)).rgb + texture(source, uv + vec2(-o.x, -o.y)).rgb) * 0.25;
}
