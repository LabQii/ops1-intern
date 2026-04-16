import { supabaseAdmin } from '../supabase';
import { extractAndChunk } from './pdfParser';
import { generateEmbedding } from './embeddings';
import { addChunks, getStoreSize, clearStore } from './vectorStore';
import { VectorItem } from '@/types';

let isInitialized = false;

/**
 * Initialize the in-memory vector store from all documents stored in Supabase.
 * Called lazily on first chat request if store is empty.
 */
export async function initStoreFromSupabase(): Promise<void> {
  if (isInitialized) return;

  try {
    const { data: docs, error } = await supabaseAdmin
      .from('ops1_documents')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !docs || docs.length === 0) {
      isInitialized = true;
      return;
    }

    for (const doc of docs) {
      const { data: fileData, error: dlError } = await supabaseAdmin.storage
        .from('ops1-documents')
        .download(doc.file_path);

      if (dlError || !fileData) continue;

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const chunks = await extractAndChunk(buffer, doc.file_name);

      const vectorItems: VectorItem[] = [];
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text);
        vectorItems.push({ chunk, embedding });
      }
      addChunks(vectorItems);
    }

    isInitialized = true;
  } catch (err) {
    console.error('[storeManager] Init error:', err);
  }
}

/** Call this when a new document is uploaded so next request re-loads */
export function markStoreStale(): void {
  isInitialized = false;
}
