import { Chunk } from '@/types';
import { PDFParse } from 'pdf-parse';

// Fix pdfjs worker initialization for Node.js environments.
// We use require.resolve to safely find the worker file path.
try {
  const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
  PDFParse.setWorker(workerPath);
} catch (e) {
  // Fallback to undefined (fake worker) if worker file can't be resolved
  PDFParse.setWorker(undefined);
}

const CHUNK_SIZE = 600;
const OVERLAP = 80;

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function extractAndChunk(buffer: Buffer, source: string): Promise<Chunk[]> {
  const parser = new PDFParse({
    data: buffer,
    isOffscreenCanvasSupported: false,
    useWorkerFetch: false,
  });

  const result = await parser.getText();
  await parser.destroy();
  const text = result.text.replace(/\s+/g, ' ').trim();

  const chunks: Chunk[] = [];
  let index = 0;
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 50) {
      chunks.push({
        id: generateId(),
        text: chunkText,
        source,
        index: index++,
      });
    }

    if (end === text.length) break;
    start = end - OVERLAP;
  }

  return chunks;
}
