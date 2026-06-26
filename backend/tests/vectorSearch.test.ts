import { describe, it, expect } from 'vitest';
import { cosineSimilarity, findKNearest } from '../src/services/vectorSearch.js';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical normalized vectors', () => {
    const v = [0.5, 0.5, 0.5, 0.5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('returns 0 when either vector is all zeros', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('dimension mismatch');
  });
});

describe('findKNearest', () => {
  const candidates = [
    { transactionId: 1, categoryId: 'groceries', embedding: [1, 0, 0] },
    { transactionId: 2, categoryId: 'dining', embedding: [0, 1, 0] },
    { transactionId: 3, categoryId: 'groceries', embedding: [0.9, 0.1, 0] },
    { transactionId: 4, categoryId: 'travel', embedding: [0, 0, 1] },
  ];

  it('returns K results sorted by similarity descending', () => {
    const query = [1, 0, 0];
    const results = findKNearest(query, candidates, 2);
    expect(results).toHaveLength(2);
    expect(results[0].transactionId).toBe(1);
    expect(results[0].similarity).toBeCloseTo(1.0, 3);
    expect(results[1].transactionId).toBe(3);
    expect(results[1].similarity).toBeGreaterThan(0.9);
  });

  it('returns all candidates when K > candidates.length', () => {
    const query = [1, 0, 0];
    const results = findKNearest(query, candidates, 100);
    expect(results).toHaveLength(4);
  });

  it('returns empty array for empty candidates', () => {
    const results = findKNearest([1, 0], [], 5);
    expect(results).toEqual([]);
  });
});
