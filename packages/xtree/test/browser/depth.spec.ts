import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from './test.js';
import type { Matrix4 } from 'three';
import { PerspectiveCamera, Vector3 } from 'three';
import { random, runShader, vec4s } from './harness.js';

const require = createRequire(import.meta.url);
const packing = /`([\s\S]*)`/.exec(
  readFileSync(
    require.resolve('three/src/renderers/shaders/ShaderChunk/packing.glsl.js'),
    'utf8',
  ),
)![1]!;

const mat4 = (m: Matrix4) =>
  `mat4(${m.elements.map((v) => v.toPrecision(9)).join(', ')})`;

test.describe('depth chunk', () => {
  test('depth conversions match three.js packing', async ({ page }) => {
    const next = random(7);
    const inputs: number[] = [];
    for (let i = 0; i < 512; i++) {
      const near = 0.01 + next() * 2;
      const far = near + 1 + next() * 500;
      inputs.push(next(), near, far, -(near + next() * (far - near)));
    }
    const out = vec4s(
      await runShader(page, {
        prelude: packing,
        source: `#include <xtree/depth/reconstruct>
vec4 xt_test(vec4 v, int index) {
  float a = xt_perspectiveDepthToViewZ(v.x, v.y, v.z);
  float b = perspectiveDepthToViewZ(v.x, v.y, v.z);
  float c = xt_orthographicDepthToViewZ(v.x, v.y, v.z);
  float d = orthographicDepthToViewZ(v.x, v.y, v.z);
  float e = xt_viewZToPerspectiveDepth(v.w, v.y, v.z);
  float f = viewZToPerspectiveDepth(v.w, v.y, v.z);
  return vec4(abs(a - b) / max(abs(b), 1e-6), abs(c - d) / max(abs(d), 1e-6), abs(e - f), xt_viewZToLinearDepth(v.w, v.y, v.z));
}`,
        inputs,
      }),
    );
    out.forEach(([perspective, orthographic, depth, linear], i) => {
      expect(perspective).toBeLessThan(1e-6);
      expect(orthographic).toBeLessThan(1e-6);
      expect(depth).toBeLessThan(1e-6);
      const [, near, far, viewZ] = inputs.slice(i * 4, i * 4 + 4) as number[];
      expect(
        Math.abs(linear! - (-viewZ! - near!) / (far! - near!)),
      ).toBeLessThan(1e-5);
    });
  });

  test('view positions round-trip through the projection', async ({ page }) => {
    const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 100);
    camera.updateProjectionMatrix();
    const next = random(11);
    const points = Array.from(
      { length: 256 },
      () =>
        new Vector3(
          (next() - 0.5) * 8,
          (next() - 0.5) * 4,
          -(0.5 + next() * 60),
        ),
    );
    // Screen UV and depth-buffer value for each point.
    const inputs = points.flatMap((p) => {
      const ndc = p.clone().applyMatrix4(camera.projectionMatrix);
      return [ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5, ndc.z * 0.5 + 0.5, 0];
    });
    const out = vec4s(
      await runShader(page, {
        source: `#include <xtree/depth/reconstruct>
vec4 xt_test(vec4 v, int index) {
  return vec4(xt_viewPositionFromDepth(v.xy, v.z, ${mat4(camera.projectionMatrixInverse)}), 0.0);
}`,
        inputs,
      }),
    );
    out.forEach(([x, y, z], i) => {
      const p = points[i]!;
      // Float32 depth near the far plane limits precision to about 0.1%.
      expect(
        Math.hypot(x! - p.x, y! - p.y, z! - p.z) / p.length(),
      ).toBeLessThan(2e-3);
    });
  });

  test('normals from depth recover a plane', async ({ page }) => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.updateProjectionMatrix();
    // A tilted plane through (0, 0, -5) with this view-space normal.
    const normal = new Vector3(0.3, 0.5, 0.8).normalize();
    const size = 64;
    const data: number[] = [];
    const inverse = camera.projectionMatrixInverse;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const ndc = new Vector3(
          ((x + 0.5) / size) * 2 - 1,
          ((y + 0.5) / size) * 2 - 1,
          0.5,
        );
        const ray = ndc.applyMatrix4(inverse).normalize();
        const t = new Vector3(0, 0, -5).dot(normal) / ray.dot(normal);
        const hit = ray.multiplyScalar(t).applyMatrix4(camera.projectionMatrix);
        data.push(hit.z * 0.5 + 0.5, 0, 0, 1);
      }
    }
    const inputs: number[] = [];
    for (let i = 0; i < 64; i++)
      inputs.push(0.2 + (i % 8) * 0.08, 0.2 + Math.floor(i / 8) * 0.08, 0, 0);
    const out = vec4s(
      await runShader(page, {
        aux: { width: size, height: size, data },
        source: `#include <xtree/depth/reconstruct>
vec4 xt_test(vec4 v, int index) {
  return vec4(xt_normalFromDepth(xt_aux, v.xy, vec2(1.0 / ${size}.0), ${mat4(inverse)}), 0.0);
}`,
        inputs,
      }),
    );
    for (const [x, y, z] of out) {
      expect(x! * normal.x + y! * normal.y + z! * normal.z).toBeGreaterThan(
        0.999,
      );
    }
  });
});
