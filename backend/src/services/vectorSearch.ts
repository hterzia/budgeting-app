/**
 * Compute cosine similarity between two vectors.
 * Returns value in [-1, 1]. For L2-normalized vectors, this equals the dot product.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the K nearest neighbors from a set of candidate embeddings.
 * Returns results sorted by similarity descending.
 */
export function findKNearest(
  queryEmbedding: number[],
  candidates: Array<{ transactionId: number; categoryId: string; embedding: number[] }>,
  k: number
): Array<{ transactionId: number; categoryId: string; similarity: number }> {
  const scored = candidates.map(c => ({
    transactionId: c.transactionId,
    categoryId: c.categoryId,
    similarity: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}
