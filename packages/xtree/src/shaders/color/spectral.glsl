/**
 * Spectral helpers: wavelengths to color and thin-film interference. The
 * CIE 1931 2° color-matching functions use the multi-lobe Gaussian fit of
 * Wyman, Sloan and Shirley ("Simple Analytic Approximations to the CIE XYZ
 * Color Matching Functions", JCGT 2013).
 */

/// CIE 1931 2° color-matching functions (x̄, ȳ, z̄) at a wavelength in nanometres.
vec3 xt_wavelengthToXyz(float nm) {
  float t1 = (nm - 442.0) * (nm < 442.0 ? 0.0624 : 0.0374);
  float t2 = (nm - 599.8) * (nm < 599.8 ? 0.0264 : 0.0323);
  float t3 = (nm - 501.1) * (nm < 501.1 ? 0.0490 : 0.0382);
  float t4 = (nm - 568.8) * (nm < 568.8 ? 0.0213 : 0.0247);
  float t5 = (nm - 530.9) * (nm < 530.9 ? 0.0613 : 0.0322);
  float t6 = (nm - 437.0) * (nm < 437.0 ? 0.0845 : 0.0278);
  float t7 = (nm - 459.0) * (nm < 459.0 ? 0.0385 : 0.0725);
  return vec3(
    0.362 * exp(-0.5 * t1 * t1) + 1.056 * exp(-0.5 * t2 * t2) - 0.065 * exp(-0.5 * t3 * t3),
    0.821 * exp(-0.5 * t4 * t4) + 0.286 * exp(-0.5 * t5 * t5),
    1.217 * exp(-0.5 * t6 * t6) + 0.681 * exp(-0.5 * t7 * t7)
  );
}

/// CIE XYZ to linear sRGB (D65).
vec3 xt_xyzToLinearSrgb(vec3 xyz) {
  return mat3(
    3.2404542, -0.9692660, 0.0556434,
    -1.5371385, 1.8760108, -0.2040259,
    -0.4985314, 0.0415560, 1.0572252
  ) * xyz;
}

/// Linear sRGB color of light at one wavelength, scaled so the brightest wavelengths reach about 1; may be out of gamut (negative).
vec3 xt_wavelengthToLinearSrgb(float nm) {
  return xt_xyzToLinearSrgb(xt_wavelengthToXyz(nm));
}

/// Reflected color of a thin film (a soap bubble or oil slick in air): thickness in nm, film IOR, and the cosine of the angle to the normal. Integrated over 16 wavelengths and normalized so a flat spectrum is white.
vec3 xt_thinFilm(float thickness, float ior, float cosTheta) {
  float sinT2 = (1.0 - cosTheta * cosTheta) / (ior * ior);
  // Optical path difference between the two reflected beams.
  float opd = 2.0 * ior * thickness * sqrt(max(1.0 - sinT2, 0.0));
  vec3 sum = vec3(0.0);
  vec3 white = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    float nm = 400.0 + 300.0 * (float(i) + 0.5) / 16.0;
    vec3 cmf = xt_wavelengthToXyz(nm);
    // The top reflection is phase-shifted by half a wave, so a very thin film is dark.
    sum += cmf * (0.5 - 0.5 * cos(6.2831853 * opd / nm));
    white += cmf;
  }
  return max(xt_xyzToLinearSrgb(sum) / xt_xyzToLinearSrgb(white), 0.0);
}
