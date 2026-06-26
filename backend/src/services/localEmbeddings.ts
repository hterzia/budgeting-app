import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';
import path from 'path';
import os from 'os';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSIONS = 384;
const BATCH_SIZE = 64;

let embeddingPipeline: FeatureExtractionPipeline | null = null;

/**
 * Initialize the embedding model. Call once at app startup.
 * Downloads ~50MB model on first run, cached thereafter.
 */
export async function initEmbeddingModel(): Promise<void> {
  if (embeddingPipeline) return;

  // Set cache directory — Electron sets TRANSFORMERS_CACHE to bundled models
  // in app resources (fully offline). Dev mode falls back to default HF cache.
  env.cacheDir = process.env['TRANSFORMERS_CACHE']
    || path.join(os.homedir(), '.cache', 'huggingface', 'transformers');
  // Disable remote model fetching when bundled models are available
  if (process.env['TRANSFORMERS_CACHE']) {
    env.allowRemoteModels = false;
  }

  embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
    dtype: 'fp32',
    device: 'cpu',
  });
}

/**
 * Generate embeddings for an array of text strings.
 * Returns number[][] where each inner array has 384 elements.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized. Call initEmbeddingModel() first.');
  }

  const output = await embeddingPipeline(texts, {
    pooling: 'mean',
    normalize: true,
  });

  return output.tolist();
}

/**
 * Generate embeddings in batches for large sets of texts.
 */
export async function generateEmbeddingsInBatches(
  texts: string[],
  onProgress?: (embedded: number, total: number) => void
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await generateEmbeddings(batch);
    allEmbeddings.push(...embeddings);
    onProgress?.(allEmbeddings.length, texts.length);
  }

  return allEmbeddings;
}

export { MODEL_NAME };
