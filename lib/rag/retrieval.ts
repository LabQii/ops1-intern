import { generateEmbedding } from './embeddings';
import { queryTopK } from './vectorStore';

export async function retrieveContext(query: string): Promise<string> {
  const queryEmbedding = await generateEmbedding(query);
  const topChunks = queryTopK(queryEmbedding, 10);

  if (topChunks.length === 0) {
    return '';
  }

  return topChunks
    .map((chunk, i) => `[Sumber: ${chunk.source}]\n${chunk.text}`)
    .join('\n\n');
}
