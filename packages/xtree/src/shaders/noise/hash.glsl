/**
 * Integer hashes for noise and randomness. Every float result is in [0, 1).
 * Uses the PCG family from Jarzynski and Olano, "Hash Functions for GPU
 * Rendering", JCGT 9(3), 2020.
 */

/// One round of the 32-bit PCG hash.
uint xt_pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

/// Three-dimensional PCG hash (pcg3d).
uvec3 xt_pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}

/// Four-dimensional PCG hash (pcg4d).
uvec4 xt_pcg4d(uvec4 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.w;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v.w += v.y * v.z;
  v ^= v >> 16u;
  v.x += v.y * v.w;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v.w += v.y * v.z;
  return v;
}

/// Maps the top 24 bits of a hash to a float in [0, 1).
float xt_uintToUnit(uint v) {
  return float(v >> 8u) * (1.0 / 16777216.0);
}
vec2 xt_uintToUnit(uvec2 v) {
  return vec2(v >> 8u) * (1.0 / 16777216.0);
}
vec3 xt_uintToUnit(uvec3 v) {
  return vec3(v >> 8u) * (1.0 / 16777216.0);
}
vec4 xt_uintToUnit(uvec4 v) {
  return vec4(v >> 8u) * (1.0 / 16777216.0);
}

/// Hashes the bit pattern of a float, vec2, vec3 or vec4 to one value in [0, 1).
float xt_hash1(float p) {
  return xt_uintToUnit(xt_pcg(floatBitsToUint(p)));
}
float xt_hash1(vec2 p) {
  return xt_uintToUnit(xt_pcg3d(uvec3(floatBitsToUint(p), 0u)).x);
}
float xt_hash1(vec3 p) {
  return xt_uintToUnit(xt_pcg3d(floatBitsToUint(p)).x);
}
float xt_hash1(vec4 p) {
  return xt_uintToUnit(xt_pcg4d(floatBitsToUint(p)).x);
}

/// Hashes a vec2, vec3 or vec4 to two values in [0, 1).
vec2 xt_hash2(vec2 p) {
  return xt_uintToUnit(xt_pcg3d(uvec3(floatBitsToUint(p), 0u)).xy);
}
vec2 xt_hash2(vec3 p) {
  return xt_uintToUnit(xt_pcg3d(floatBitsToUint(p)).xy);
}
vec2 xt_hash2(vec4 p) {
  return xt_uintToUnit(xt_pcg4d(floatBitsToUint(p)).xy);
}

/// Hashes a vec2, vec3 or vec4 to three values in [0, 1).
vec3 xt_hash3(vec2 p) {
  return xt_uintToUnit(xt_pcg3d(uvec3(floatBitsToUint(p), 0u)));
}
vec3 xt_hash3(vec3 p) {
  return xt_uintToUnit(xt_pcg3d(floatBitsToUint(p)));
}
vec3 xt_hash3(vec4 p) {
  return xt_uintToUnit(xt_pcg4d(floatBitsToUint(p)).xyz);
}

/// Hashes a vec4 to four values in [0, 1).
vec4 xt_hash4(vec4 p) {
  return xt_uintToUnit(xt_pcg4d(floatBitsToUint(p)));
}

/// Hashes an integer lattice point to three values in [0, 1). Used by lattice noises.
vec3 xt_latticeHash(ivec3 c) {
  return xt_uintToUnit(xt_pcg3d(uvec3(c)));
}

/// Hashes a four-dimensional integer lattice point to four values in [0, 1).
vec4 xt_latticeHash(ivec4 c) {
  return xt_uintToUnit(xt_pcg4d(uvec4(c)));
}

/// Offsets noise coordinates by an effect's `seed`: each seed gives an unrelated pattern, and seed 0 leaves the coordinates unchanged. The offset stays under 100 so large seeds don't cost precision.
float xt_seeded(float p, int seed) {
  return p + fract(float(seed) * 0.6180340) * 97.0;
}

/// `xt_seeded` for 2D coordinates.
vec2 xt_seeded(vec2 p, int seed) {
  return p + fract(float(seed) * vec2(0.6180340, 0.7548777)) * vec2(97.0, 89.0);
}

/// `xt_seeded` for 3D coordinates.
vec3 xt_seeded(vec3 p, int seed) {
  return p + fract(float(seed) * vec3(0.6180340, 0.7548777, 0.5698403)) * vec3(97.0, 89.0, 83.0);
}

/// `xt_seeded` for 4D coordinates.
vec4 xt_seeded(vec4 p, int seed) {
  return p + fract(float(seed) * vec4(0.6180340, 0.7548777, 0.5698403, 0.8191725)) * vec4(97.0, 89.0, 83.0, 79.0);
}
