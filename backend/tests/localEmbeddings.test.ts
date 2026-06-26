import { describe, it, expect, beforeAll } from 'vitest';
import { initEmbeddingModel, generateEmbeddings, EMBEDDING_DIMENSIONS } from '../src/services/localEmbeddings.js';

describe('localEmbeddings', () => {
  beforeAll(async () => {
    await initEmbeddingModel();
  }, 120_000);

  it('returns 384-dimensional embeddings', async () => {
    const results = await generateEmbeddings(['Hello world']);
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(results[0].every(v => typeof v === 'number' && !isNaN(v))).toBe(true);
  });

  it('returns one embedding per input text', async () => {
    const results = await generateEmbeddings(['text one', 'text two', 'text three']);
    expect(results).toHaveLength(3);
    results.forEach(emb => expect(emb).toHaveLength(EMBEDDING_DIMENSIONS));
  });

  it('produces similar embeddings for similar text', async () => {
    const [a, b, c] = await generateEmbeddings([
      'Starbucks coffee purchase',
      'Coffee shop latte',
      'Monthly rent payment',
    ]);

    const cosine = (x: number[], y: number[]) => {
      let dot = 0, nX = 0, nY = 0;
      for (let i = 0; i < x.length; i++) { dot += x[i]*y[i]; nX += x[i]*x[i]; nY += y[i]*y[i]; }
      return dot / (Math.sqrt(nX) * Math.sqrt(nY));
    };

    const simAB = cosine(a, b);
    const simAC = cosine(a, c);

    expect(simAB).toBeGreaterThan(0.5);
    expect(simAC).toBeLessThan(simAB);
  });

  it('returns empty array for empty input', async () => {
    const results = await generateEmbeddings([]);
    expect(results).toEqual([]);
  });
}, { timeout: 180_000 });
