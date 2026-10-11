// Mirror: copies one half of the frame onto the other, flipped, across a vertical, horizontal or both axes.
vec4 $main(vec4 color, vec2 uv) {
  vec2 st = uv;
  if ($axis != $axis_horizontal) {
    float d = st.x - $position.x;
    if ($flip ? d < 0.0 : d > 0.0) st.x = $position.x - d;
  }
  if ($axis != $axis_vertical) {
    float d = st.y - $position.y;
    if ($flip ? d > 0.0 : d < 0.0) st.y = $position.y - d;
  }
  if (st == uv) return color;
  return xt_sample(clamp(st, 0.0, 1.0));
}
