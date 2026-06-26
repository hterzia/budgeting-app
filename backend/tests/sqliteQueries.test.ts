import { describe, it, expect } from 'vitest';
import { serializeEmbedding, deserializeEmbedding } from '../src/db/sqliteQueries.js';

describe('embedding serialization', () => {
  it('roundtrips a 384-dim vector through Float32', () => {
    const original = Array.from({ length: 384 }, (_, i) => Math.sin(i) * 0.5);
    const buffer = serializeEmbedding(original);
    expect(buffer.byteLength).toBe(384 * 4);
    const restored = deserializeEmbedding(buffer);
    expect(restored.length).toBe(384);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i], 5);
    }
  });

  it('handles zero vector', () => {
    const zeros = new Array(384).fill(0);
    const buffer = serializeEmbedding(zeros);
    const restored = deserializeEmbedding(buffer);
    expect(restored).toEqual(zeros);
  });

  it('handles negative values', () => {
    const vec = [-1, -0.5, 0, 0.5, 1];
    const buffer = serializeEmbedding(vec);
    const restored = deserializeEmbedding(buffer);
    for (let i = 0; i < vec.length; i++) {
      expect(restored[i]).toBeCloseTo(vec[i], 5);
    }
  });
});
