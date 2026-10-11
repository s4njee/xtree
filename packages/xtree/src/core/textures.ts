import {
  ClampToEdgeWrapping,
  Data3DTexture,
  DataTexture,
  FloatType,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import { bakeCurve, bakeGradient } from '../effect/bake.js';
import type { SampleTexture } from '../effect/params.js';

/**
 * Builds a three.js texture from an effect's sample data. 3D textures are
 * read with `texelFetch`, so they stay unfiltered; float data makes a float
 * texture.
 */
export function createSampleTexture(
  input: SampleTexture,
): DataTexture | Data3DTexture {
  // Gradients and curves arrive as values; bake them here so effect bundles don't carry the baker.
  const sample =
    input.kind === 'gradient'
      ? bakeGradient(input.stops)
      : input.kind === 'curve'
        ? bakeCurve(input.points)
        : input;
  if (sample.kind === 'data3d') {
    const texture = new Data3DTexture(
      sample.data,
      sample.size,
      sample.size,
      sample.size,
    );
    texture.format = RGBAFormat;
    texture.type = FloatType;
    texture.minFilter = texture.magFilter = NearestFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
  }
  const float = sample.data instanceof Float32Array;
  const texture = new DataTexture(
    sample.data,
    sample.width,
    sample.height,
    RGBAFormat,
    float ? FloatType : UnsignedByteType,
  );
  texture.minFilter = texture.magFilter =
    sample.filter === 'nearest' ? NearestFilter : LinearFilter;
  texture.wrapS = texture.wrapT =
    sample.wrap === 'repeat' ? RepeatWrapping : ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
