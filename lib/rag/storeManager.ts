import { supabaseAdmin } from '../supabase';
import { extractAndChunk } from './pdfParser';
import { generateEmbedding } from './embeddings';
import { addChunks, getStoreSize, clearStore } from './vectorStore';
import { VectorItem } from '@/types';

let isInitialized = false;
let isInitializing = false;

/**
 * Initialize the in-memory vector store from all documents stored in Supabase.
 * Called lazily on first chat request if store is empty.
 */
export async function initStoreFromSupabase(): Promise<void> {
  if (isInitialized || isInitializing) return;
  isInitializing = true;

  try {
    const { data: docs, error } = await supabaseAdmin
      .from('ops1_documents')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!docs || docs.length === 0) {
      console.log('[storeManager] No documents found in Supabase.');
      isInitialized = true;
      return;
    }

    console.log(`[storeManager] Initializing store from Supabase... found ${docs.length} documents.`);

    for (const doc of docs) {
      console.log(`[storeManager] Loading document: ${doc.file_name} from ${doc.file_path}`);
      const { data: fileData, error: dlError } = await supabaseAdmin.storage
        .from('ops1-documents')
        .download(doc.file_path);

      if (dlError || !fileData) {
        console.error(`[storeManager] Failed to download ${doc.file_name}:`, dlError);
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const chunks = await extractAndChunk(buffer, doc.file_name);
      console.log(`[storeManager] Extracted ${chunks.length} chunks from ${doc.file_name} (${buffer.length} bytes)`);

      if (chunks.length === 0) {
        console.warn(`[storeManager] WARNING: 0 chunks from ${doc.file_name} — PDF may not be text-based!`);
        continue;
      }

      const vectorItems: VectorItem[] = [];
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text);
        vectorItems.push({ chunk, embedding });
      }
      addChunks(vectorItems);
      console.log(`[storeManager] Added ${vectorItems.length} vectors for ${doc.file_name}`);
    }

    isInitialized = true;
    console.log(`[storeManager] Initialization complete. Total chunks in store: ${getStoreSize()}`);
  } catch (err) {
    console.error('[storeManager] Init error:', err);
  } finally {
    isInitializing = false;
  }
}

/** Call this when a new document is uploaded so next request re-loads */
export function markStoreStale(): void {
  isInitialized = false;
}
