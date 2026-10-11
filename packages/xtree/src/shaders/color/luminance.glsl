/**
 * Luminance and luma weights.
 */

/// Relative luminance of linear Rec.709 / sRGB primaries (ITU-R BT.709).
float xt_luminance(vec3 linearRgb) {
  return dot(linearRgb, vec3(0.2126, 0.7152, 0.0722));
}

/// Luma of gamma-encoded RGB with Rec.601 weights, as used by analog video effects.
float xt_luma601(vec3 encodedRgb) {
  return dot(encodedRgb, vec3(0.299, 0.587, 0.114));
}
