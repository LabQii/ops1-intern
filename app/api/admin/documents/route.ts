import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
import { supabaseAdmin } from '@/lib/supabase';
import { extractAndChunk } from '@/lib/rag/pdfParser';
import { generateEmbedding } from '@/lib/rag/embeddings';
import { addChunks, removeDocumentChunks } from '@/lib/rag/vectorStore';
import { markStoreStale } from '@/lib/rag/storeManager';
import { VectorItem } from '@/types';

// Admin auth check helper
function isAuthenticated(req: NextRequest) {
  return req.cookies.get('ops1_admin')?.value === 'ops1-admin-authenticated-2025';
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('ops1_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, documents: data });
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, message: 'Invalid or missing PDF file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name}`;
    
    // 1. Upload to storage
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('ops1-documents')
      .upload(fileName, buffer, { contentType: 'application/pdf' });

    if (storageError) throw storageError;

    const { data: urlData } = supabaseAdmin.storage
      .from('ops1-documents')
      .getPublicUrl(fileName);

    // 2. Insert record to DB
    const { data: docData, error: dbError } = await supabaseAdmin
      .from('ops1_documents')
      .insert({
        file_name: file.name,
        file_path: fileName,
        file_url: urlData.publicUrl,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 3. Process RAG chunks 
    const chunks = await extractAndChunk(buffer, docData.file_name);
    const vectorItems: VectorItem[] = [];
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);
      vectorItems.push({ chunk, embedding });
    }
    
    // Automatically make active in memory and flag for reloads
    addChunks(vectorItems);
    markStoreStale();

    return NextResponse.json({
      success: true,
      document: docData,
      chunksCount: chunks.length,
    });
  } catch (error: any) {
    console.error('Upload admin error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthenticated(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, message: 'Missing ID' }, { status: 400 });

    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('ops1_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !doc) throw new Error('Document not found');

    // 1. Delete from DB
    await supabaseAdmin.from('ops1_documents').delete().eq('id', id);

    // 2. Delete from storage
    await supabaseAdmin.storage.from('ops1-documents').remove([doc.file_path]);

    // 3. Clear from memory
    removeDocumentChunks(doc.file_name);
    markStoreStale();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Delete failed' }, { status: 500 });
  }
}
