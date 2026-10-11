/**
 * Depth buffer helpers: stored depth to view-space Z and back, view
 * positions from depth, and normals estimated from depth. The conventions
 * match three.js (`perspectiveDepthToViewZ`, `orthographicDepthToViewZ`):
 * the camera looks down -Z, so view Z is negative in front of it.
 */

/// View-space Z (negative in front of the camera) from a perspective depth-buffer value in [0, 1].
float xt_perspectiveDepthToViewZ(float depth, float near, float far) {
  return (near * far) / ((far - near) * depth - far);
}

/// View-space Z from an orthographic depth-buffer value in [0, 1].
float xt_orthographicDepthToViewZ(float depth, float near, float far) {
  return depth * (near - far) - near;
}

/// Perspective depth-buffer value for a view-space Z; the inverse of xt_perspectiveDepthToViewZ.
float xt_viewZToPerspectiveDepth(float viewZ, float near, float far) {
  return ((near + viewZ) * far) / ((far - near) * viewZ);
}

/// Linear depth in [0, 1] from the near plane to the far plane.
float xt_viewZToLinearDepth(float viewZ, float near, float far) {
  return (-viewZ - near) / (far - near);
}

/// View-space position of a screen UV and depth-buffer value, through the inverse projection matrix.
vec3 xt_viewPositionFromDepth(vec2 uv, float depth, mat4 inverseProjection) {
  vec4 view = inverseProjection * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
  return view.xyz / view.w;
}

/// View-space normal estimated from a depth texture. Each axis differences toward the neighbour nearer in depth, so silhouettes don't smear.
vec3 xt_normalFromDepth(sampler2D depthTexture, vec2 uv, vec2 texel, mat4 inverseProjection) {
  vec3 c = xt_viewPositionFromDepth(uv, texture(depthTexture, uv).r, inverseProjection);
  vec2 dx = vec2(texel.x, 0.0);
  vec2 dy = vec2(0.0, texel.y);
  vec3 l = xt_viewPositionFromDepth(uv - dx, texture(depthTexture, uv - dx).r, inverseProjection);
  vec3 r = xt_viewPositionFromDepth(uv + dx, texture(depthTexture, uv + dx).r, inverseProjection);
  vec3 d = xt_viewPositionFromDepth(uv - dy, texture(depthTexture, uv - dy).r, inverseProjection);
  vec3 u = xt_viewPositionFromDepth(uv + dy, texture(depthTexture, uv + dy).r, inverseProjection);
  vec3 h = abs(c.z - l.z) < abs(r.z - c.z) ? c - l : r - c;
  vec3 v = abs(c.z - d.z) < abs(u.z - c.z) ? c - d : u - c;
  return normalize(cross(h, v));
}
