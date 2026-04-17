import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiKeys } from '@/lib/apiKeys';

export async function generateEmbedding(text: string): Promise<number[]> {
  let attempts = geminiKeys.getKeyCount();
  while (attempts > 0) {
    const currentKey = geminiKeys.getCurrentKey();
    const genAI = new GoogleGenerativeAI(currentKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    try {
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('rate limit')) {
        console.warn('Gemini embeddings 429 on current key, rotating...');
        const nextKey = geminiKeys.rotateOnRateLimit();
        if (!nextKey) throw err;
        attempts--;
      } else {
        throw err;
      }
    }
  }
  throw new Error('All Gemini keys rate limited');
}
