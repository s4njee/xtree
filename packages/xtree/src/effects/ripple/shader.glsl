// Ripple: radial displacement by a damped travelling sine, or by one ring profile that expands and repeats.
vec4 $main(vec4 color, vec2 uv) {
  float aspect = xt_resolution.x / xt_resolution.y;
  vec2 d = (uv - $center) * vec2(aspect, 1.0);
  float r = length(d);
  vec2 dir = r > 1e-5 ? d / r : vec2(0.0);
  float k = 6.2831853 / $wavelength;

  float offset, slope;
  if ($mode == $mode_shockwave) {
    // The ring has been travelling for `age` seconds; it starts at the center.
    float age = mod(xt_time + $phase * $interval, $interval);
    float x = (r - age * $speed) / $wavelength;
    // One cycle of a sine under a smooth window: a crest followed by a trough.
    float window = x > -1.0 && x < 1.0 ? 0.5 + 0.5 * cos(3.1415927 * x) : 0.0;
    float fade = exp(-$decay * age);
    offset = sin(3.1415927 * x) * window * fade;
    slope = cos(3.1415927 * x) * window * fade;
  } else {
    float phase = k * r - k * $speed * xt_time;
    float envelope = exp(-$decay * r) * smoothstep(0.0, 0.5 * $wavelength, r);
    offset = sin(phase) * envelope;
    slope = cos(phase) * envelope;
  }

  vec2 st = uv - dir * offset * $amplitude / vec2(aspect, 1.0);
  vec4 sampled = xt_sample(clamp(st, 0.0, 1.0));
  sampled.rgb *= 1.0 + $shading * slope * min($amplitude * k, 1.0);
  return vec4(sampled.rgb, color.a);
}
