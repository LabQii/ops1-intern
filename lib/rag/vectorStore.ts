import { VectorItem, Chunk } from '@/types';

// In-memory vector store (per server instance)
const store = new Map<string, VectorItem>();

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function addChunks(items: VectorItem[]): void {
  for (const item of items) {
    store.set(item.chunk.id, item);
  }
}

export function removeDocumentChunks(sourceFileName: string): void {
  for (const [id, item] of store.entries()) {
    if (item.chunk.source === sourceFileName) {
      store.delete(id);
    }
  }
}

export function queryTopK(queryEmbedding: number[], k = 4, threshold = 0.15): Chunk[] {
  const results: Array<{ chunk: Chunk; score: number }> = [];
  for (const item of store.values()) {
    const score = cosineSimilarity(queryEmbedding, item.embedding);
    if (score >= threshold) {
      results.push({ chunk: item.chunk, score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k).map((r) => r.chunk);
}

export function clearStore(): void {
  store.clear();
}

export function getStoreSize(): number {
  return store.size;
}
