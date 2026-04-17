import { Chunk } from '@/types';
import PDFParser from 'pdf2json';

const CHUNK_SIZE = 1500;
const OVERLAP = 200;

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/** Extract raw text from a PDF buffer using pdf2json (pure Node.js, no worker/browser APIs). */
function parsePdfBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // Suppress console.warn briefly to hide pdf2json warnings (Fake worker, Link fields etc)
    const originalWarn = console.warn;
    console.warn = () => {};

    // Second arg `1` = raw text mode (disables URL encoding of text)
    const parser = new PDFParser(null, 1);

    parser.on('pdfParser_dataReady', () => {
      console.warn = originalWarn;
      try {
        const raw = (parser as any).getRawTextContent() as string;
        resolve(raw);
      } catch (e) {
        reject(e);
      }
    });

    parser.on('pdfParser_dataError', (err: any) => {
      console.warn = originalWarn;
      reject(err?.parserError ?? err);
    });

    try {
      parser.parseBuffer(buffer);
    } catch (err) {
      console.warn = originalWarn;
      reject(err);
    }
  });
}

export async function extractAndChunk(buffer: Buffer, source: string): Promise<Chunk[]> {
  let text = '';
  try {
    const raw = await parsePdfBuffer(buffer);
    text = raw.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error(`[pdfParser] Failed to parse PDF ${source}:`, error);
    text = '';
  }

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
