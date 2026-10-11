/**
 * White balance by von Kries adaptation to D65 in Bradford cone space. The
 * temperature sets the illuminant the scene is assumed to be lit by, as in
 * photo editors: lower values make the image cooler, higher values warmer.
 * The Planckian locus is shifted slightly so that 6500 K with zero tint is
 * exactly D65, which makes the default settings an identity.
 */

/// CIE 1931 xy chromaticity on the Planckian locus, 1667–25000 K (Kim et al., 2002 cubic fit).
vec2 xt_planckianXy(float kelvin) {
  float k = clamp(kelvin, 1667.0, 25000.0);
  float k2 = k * k;
  float k3 = k2 * k;
  float x = k <= 4000.0
    ? -0.2661239e9 / k3 - 0.2343589e6 / k2 + 0.8776956e3 / k + 0.179910
    : -3.0258469e9 / k3 + 2.1070379e6 / k2 + 0.2226347e3 / k + 0.240390;
  float x2 = x * x;
  float x3 = x2 * x;
  float y = k <= 2222.0
    ? -1.1063814 * x3 - 1.34811020 * x2 + 2.18555832 * x - 0.20219683
    : k <= 4000.0
      ? -0.9549476 * x3 - 1.37418593 * x2 + 2.09137015 * x - 0.16748867
      : 3.0817580 * x3 - 5.87338670 * x2 + 3.75112997 * x - 0.37001483;
  return vec2(x, y);
}

/// CIE 1931 xy of D65, as implied by the sRGB matrices used here (XYZ white 0.95047, 1, 1.08883).
const vec2 XT_D65_XY = vec2(0.3127266, 0.3290231);

/// White point for a temperature and a tint in [-1, 1]: the locus shifted to pass through D65 at 6500 K. Tint moves the point perpendicular to the locus; positive is greener.
vec2 xt_whitePointXy(float kelvin, float tint) {
  vec2 xy = xt_planckianXy(kelvin) + (XT_D65_XY - xt_planckianXy(6500.0));
  vec2 tangent = xt_planckianXy(kelvin + 50.0) - xt_planckianXy(kelvin - 50.0);
  vec2 normal = normalize(vec2(-tangent.y, tangent.x));
  normal *= sign(normal.y);
  return xy + normal * tint * 0.05;
}

/// Bradford cone response of a chromaticity at luminance 1.
vec3 xt_xyToBradford(vec2 xy) {
  vec3 xyz = vec3(xy.x / xy.y, 1.0, (1.0 - xy.x - xy.y) / xy.y);
  return vec3(
    dot(xyz, vec3(0.8951, 0.2664, -0.1614)),
    dot(xyz, vec3(-0.7502, 1.7135, 0.0367)),
    dot(xyz, vec3(0.0389, -0.0685, 1.0296))
  );
}

/// White-balances linear sRGB. Positive tint makes the image more magenta, as in common photo editors.
vec3 xt_whiteBalance(vec3 linearRgb, float kelvin, float tint) {
  vec3 lms = vec3(
    dot(linearRgb, vec3(0.42272529274, 0.49134532439, 0.02735794451)),
    dot(linearRgb, vec3(0.05569977700, 0.96153405088, 0.02318381047)),
    dot(linearRgb, vec3(0.02138264375, 0.08764186779, 0.98050813261))
  );
  vec3 source = xt_xyToBradford(xt_whitePointXy(kelvin, tint));
  vec3 target = xt_xyToBradford(XT_D65_XY);
  lms *= target / source;
  return vec3(
    dot(lms, vec3(2.538044516786, -1.293276997926, -0.040236884261)),
    dot(lms, vec3(-0.146004057605, 1.116648305512, -0.022329026188)),
    dot(lms, vec3(-0.042298510366, -0.071607220285, 1.022752688296))
  );
}
