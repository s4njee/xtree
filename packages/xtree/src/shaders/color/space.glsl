/**
 * Color space conversions. Hues are in turns, [0, 1). "Linear" means
 * linear-light sRGB (Rec.709 primaries, D65). HSV, HSL, YIQ and YUV work on
 * whatever RGB encoding they are given; most image effects pass
 * gamma-encoded sRGB.
 */

/// sRGB transfer function, encoded to linear (IEC 61966-2-1). Negative values pass through the linear segment.
vec3 xt_srgbToLinear(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((max(c, 0.0) + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, greaterThan(c, vec3(0.04045)));
}

/// sRGB transfer function, linear to encoded (IEC 61966-2-1).
vec3 xt_linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, greaterThan(c, vec3(0.0031308)));
}

/// RGB to HSV. Returns (hue in turns, saturation, value).
vec3 xt_rgbToHsv(vec3 c) {
  float maxc = max(c.r, max(c.g, c.b));
  float minc = min(c.r, min(c.g, c.b));
  float d = maxc - minc;
  float h = 0.0;
  if (d > 1e-7) {
    if (maxc == c.r) {
      h = mod((c.g - c.b) / d, 6.0);
    } else if (maxc == c.g) {
      h = (c.b - c.r) / d + 2.0;
    } else {
      h = (c.r - c.g) / d + 4.0;
    }
    h /= 6.0;
  }
  float s = maxc > 1e-7 ? d / maxc : 0.0;
  return vec3(h, s, maxc);
}

/// HSV to RGB. Hue is in turns.
vec3 xt_hsvToRgb(vec3 c) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + c.x * 6.0, 6.0);
  return c.z - c.z * c.y * clamp(min(k, 4.0 - k), 0.0, 1.0);
}

/// RGB to HSL. Returns (hue in turns, saturation, lightness).
vec3 xt_rgbToHsl(vec3 c) {
  float maxc = max(c.r, max(c.g, c.b));
  float minc = min(c.r, min(c.g, c.b));
  float d = maxc - minc;
  float l = (maxc + minc) * 0.5;
  float h = 0.0;
  float s = 0.0;
  if (d > 1e-7) {
    if (maxc == c.r) {
      h = mod((c.g - c.b) / d, 6.0);
    } else if (maxc == c.g) {
      h = (c.b - c.r) / d + 2.0;
    } else {
      h = (c.r - c.g) / d + 4.0;
    }
    h /= 6.0;
    s = d / max(1.0 - abs(2.0 * l - 1.0), 1e-7);
  }
  return vec3(h, s, l);
}

/// HSL to RGB. Hue is in turns.
vec3 xt_hslToRgb(vec3 c) {
  vec3 k = mod(vec3(0.0, 8.0, 4.0) + c.x * 12.0, 12.0);
  float a = c.y * min(c.z, 1.0 - c.z);
  return c.z - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

/// Linear sRGB to OKLab (Ottosson, 2020). Returns (L, a, b).
vec3 xt_linearToOklab(vec3 c) {
  vec3 lms = vec3(
    dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)),
    dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)),
    dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005))
  );
  lms = sign(lms) * pow(abs(lms), vec3(1.0 / 3.0));
  return vec3(
    dot(lms, vec3(0.2104542553, 0.7936177850, -0.0040720468)),
    dot(lms, vec3(1.9779984951, -2.4285922050, 0.4505937099)),
    dot(lms, vec3(0.0259040371, 0.7827717662, -0.8086757660))
  );
}

/// OKLab to linear sRGB (Ottosson, 2020).
vec3 xt_oklabToLinear(vec3 c) {
  vec3 lms = vec3(
    dot(c, vec3(1.0, 0.3963377774, 0.2158037573)),
    dot(c, vec3(1.0, -0.1055613458, -0.0638541728)),
    dot(c, vec3(1.0, -0.0894841775, -1.2914855480))
  );
  lms = lms * lms * lms;
  return vec3(
    dot(lms, vec3(4.0767416621, -3.3077115913, 0.2309699292)),
    dot(lms, vec3(-1.2684380046, 2.6097574011, -0.3413193965)),
    dot(lms, vec3(-0.0041960863, -0.7034186147, 1.7076147010))
  );
}

/// OKLab to OKLCH. Returns (L, chroma, hue in turns). Hue is 0 for achromatic colors.
vec3 xt_oklabToOklch(vec3 c) {
  float chroma = length(c.yz);
  float hue = chroma > 1e-7 ? fract(atan(c.z, c.y) / 6.28318530718) : 0.0;
  return vec3(c.x, chroma, hue);
}

/// OKLCH to OKLab. Hue is in turns.
vec3 xt_oklchToOklab(vec3 c) {
  // Keep the angle in [-pi, pi], where GPU sin and cos are most accurate.
  float turns = fract(c.z);
  float angle = (turns > 0.5 ? turns - 1.0 : turns) * 6.28318530718;
  return vec3(c.x, c.y * cos(angle), c.y * sin(angle));
}

/// Linear sRGB to OKLCH.
vec3 xt_linearToOklch(vec3 c) {
  return xt_oklabToOklch(xt_linearToOklab(c));
}

/// OKLCH to linear sRGB.
vec3 xt_oklchToLinear(vec3 c) {
  return xt_oklabToLinear(xt_oklchToOklab(c));
}

/// RGB to YIQ (FCC NTSC). Y in [0, 1], I in about [-0.596, 0.596], Q in about [-0.523, 0.523].
vec3 xt_rgbToYiq(vec3 c) {
  return vec3(
    dot(c, vec3(0.299, 0.587, 0.114)),
    dot(c, vec3(0.5959, -0.2746, -0.3213)),
    dot(c, vec3(0.2115, -0.5227, 0.3112))
  );
}

/// YIQ to RGB, the exact inverse of xt_rgbToYiq.
vec3 xt_yiqToRgb(vec3 c) {
  return vec3(
    dot(c, vec3(1.0, 0.956050226396, 0.620754941327)),
    dot(c, vec3(1.0, -0.272052343689, -0.647205713455)),
    dot(c, vec3(1.0, -1.106704315324, 1.704421283696))
  );
}

/// RGB to YUV with BT.709 weights. U and V are in [-0.5, 0.5].
vec3 xt_rgbToYuv(vec3 c) {
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return vec3(y, (c.b - y) / 1.8556, (c.r - y) / 1.5748);
}

/// YUV (BT.709) to RGB.
vec3 xt_yuvToRgb(vec3 c) {
  float r = c.x + 1.5748 * c.z;
  float b = c.x + 1.8556 * c.y;
  float g = (c.x - 0.2126 * r - 0.0722 * b) / 0.7152;
  return vec3(r, g, b);
}
