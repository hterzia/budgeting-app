import type { Database } from 'better-sqlite3';
import { serializeEmbedding, deserializeEmbedding } from '../db/sqliteQueries.js';
import { cosineSimilarity } from './vectorSearch.js';

export interface KNNResult {
  categoryId: string;
  similarity: number;
  count: number;
}

/**
 * Get nearest neighbors for a given embedding using trusted labels only.
 * Uses cosine similarity via JS implementation (SQLite doesn't have `<=>` operator).
 * Returns similarity = cosine_similarity, not distance.
 */
export function getKNNCategory(
  db: Database,
  queryEmbedding: number[],
  userId: string,
  k: number = 20,
  minVoteProportion: number = 0.60,
  minNeighborCount: number = 2,
  minTopSimilarity: number = 0.80
): {
  categoryId: string | null;
  confidence: number;
  source: 'knn' | null;
} {
  try {
    // Build the query to get latest labels for each transaction
    // SQLite doesn't support DISTINCT ON, so we use GROUP BY + HAVING MAX
    const stmt = db.prepare(
      `WITH latest_labels AS (
         SELECT transaction_id, new_category_id AS category_id
         FROM transaction_labels
         WHERE user_id = ?
         GROUP BY transaction_id
         HAVING created_at = MAX(created_at)
       )
       SELECT ll.transaction_id, ll.category_id, e.embedding
       FROM latest_labels ll
       JOIN transaction_embeddings e ON e.transaction_id = ll.transaction_id
       ORDER BY ll.transaction_id
       LIMIT ?`
    );

    const rows = stmt.all(userId, k) as any[];

    if (rows.length === 0) {
      return { categoryId: null, confidence: 0, source: null };
    }

    // Weighted voting by cosine similarity
    const categoryVotes = new Map<string, number>();
    let totalSimilarity = 0;

    for (const row of rows) {
      const category = row.category_id;
      const embeddingBuffer = row.embedding as Buffer;
      const neighborEmbedding = deserializeEmbedding(embeddingBuffer);

      // Calculate cosine similarity (not distance)
      const sim = cosineSimilarity(queryEmbedding, neighborEmbedding);
      const weight = Math.max(0, sim); // Only positive similarities

      categoryVotes.set(category, (categoryVotes.get(category) || 0) + weight);
      totalSimilarity += weight;
    }

    if (totalSimilarity === 0) {
      return { categoryId: null, confidence: 0, source: null };
    }

    // Find winning category
    let bestCategory: string | null = null;
    let bestScore = 0;

    for (const [cat, score] of categoryVotes) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = cat;
      }
    }

    if (!bestCategory) {
      return { categoryId: null, confidence: 0, source: null };
    }

    // Calculate distinct quality metrics
    // Proportion of weighted votes going to the winning category (0-1 scale)
    const voteProportion = bestScore / totalSimilarity;

    // Count of neighbors that voted for the winning category
    const winningRows = rows.filter((r) => r.category_id === bestCategory);
    const agreementNeighborCount = winningRows.length;

    // Highest raw cosine similarity among winning neighbors
    let topSimilarity = 0;
    for (const row of winningRows) {
      const embeddingBuffer = row.embedding as Buffer;
      const neighborEmbedding = deserializeEmbedding(embeddingBuffer);
      const sim = cosineSimilarity(queryEmbedding, neighborEmbedding);
      topSimilarity = Math.max(topSimilarity, sim);
    }

    // Check thresholds using distinct, correctly-named metrics
    if (
      voteProportion >= minVoteProportion &&
      agreementNeighborCount >= minNeighborCount &&
      topSimilarity >= minTopSimilarity
    ) {
      return { categoryId: bestCategory, confidence: voteProportion, source: 'knn' };
    }

    return { categoryId: null, confidence: voteProportion, source: null };
  } catch (error: any) {
    console.error('[knn] Error running KNN query:', error.message);
    return { categoryId: null, confidence: 0, source: null };
  }
}

/**
 * Get K nearest neighbors for a transaction embedding.
 * Returns the neighbor details for debugging/inspection.
 */
export function getKNNNeighbors(
  db: Database,
  queryEmbedding: number[],
  userId: string,
  k: number = 20
): any[] {
  // Build the query to get latest labels for each transaction
  // SQLite doesn't support DISTINCT ON, so we use GROUP BY + HAVING MAX
  const stmt = db.prepare(
    `WITH latest_labels AS (
       SELECT transaction_id, new_category_id AS category_id
       FROM transaction_labels
       WHERE user_id = ?
       GROUP BY transaction_id
       HAVING created_at = MAX(created_at)
     )
     SELECT ll.transaction_id, ll.category_id, e.embedding
     FROM latest_labels ll
     JOIN transaction_embeddings e ON e.transaction_id = ll.transaction_id
     ORDER BY ll.transaction_id
     LIMIT ?`
  );

  const rows = stmt.all(userId, k) as any[];

  return rows.map((r: any) => {
    const embeddingBuffer = r.embedding as Buffer;
    const neighborEmbedding = deserializeEmbedding(embeddingBuffer);
    const similarity = cosineSimilarity(queryEmbedding, neighborEmbedding);

    return {
      transactionId: r.transaction_id,
      categoryId: r.category_id,
      similarity: similarity,
    };
  });
}
