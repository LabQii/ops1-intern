import { Chunk } from '@/types';
import PDFParser from 'pdf2json';

const CHUNK_SIZE = 1500;
const OVERLAP = 200;

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Extract raw text from a PDF buffer using pdf2json.
 * We traverse the parsed JSON structure directly (Pages > Texts > R > T)
 * because getRawTextContent() often returns blank for custom-font PDFs.
 */
function parsePdfBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const originalWarn = console.warn;
    console.warn = () => {};

    const parser = new PDFParser(null, 1);

    parser.on('pdfParser_dataReady', (pdfData: any) => {
      console.warn = originalWarn;
      try {
        const pages: any[] = pdfData?.Pages ?? [];
        const lines: string[] = [];

        for (const page of pages) {
          const texts: any[] = page?.Texts ?? [];
          const pageWords: string[] = [];

          for (const textObj of texts) {
            const runs: any[] = textObj?.R ?? [];
            for (const run of runs) {
              if (run?.T) {
                const decoded = decodeURIComponent(run.T);
                pageWords.push(decoded);
              }
            }
          }

          if (pageWords.length > 0) {
            lines.push(pageWords.join(' '));
          }
        }

        const fullText = lines.join('\n');
        console.log(`[pdfParser] Extracted ${fullText.length} chars from PDF`);
        resolve(fullText);
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
    // Normalize whitespace but preserve newlines as spaces
    text = raw.replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();
  } catch (error) {
    console.error(`[pdfParser] Failed to parse PDF ${source}:`, error);
    text = '';
  }

  if (!text) {
    console.warn(`[pdfParser] No text extracted from ${source}`);
    return [];
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

