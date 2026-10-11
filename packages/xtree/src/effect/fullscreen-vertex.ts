/** Vertex shader for a full-screen triangle with clip-space positions; passes `vUv` in [0, 1]. */
export const fullscreenVertex = `precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
