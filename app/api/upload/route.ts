import { NextRequest, NextResponse } from 'next/server';
import { extractAndChunk } from '@/lib/rag/pdfParser';
import { generateEmbedding } from '@/lib/rag/embeddings';
import { addChunks } from '@/lib/rag/vectorStore';
import { supabaseAdmin } from '@/lib/supabase';
import { VectorItem } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Tidak ada file yang diunggah' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, message: 'Hanya file PDF yang didukung' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload file to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`;
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('ops1-documents')
      .upload(fileName, buffer, { contentType: 'application/pdf', upsert: false });

    let fileUrl: string | undefined;
    if (!storageError && storageData) {
      const { data: urlData } = supabaseAdmin.storage
        .from('ops1-documents')
        .getPublicUrl(fileName);
      fileUrl = urlData.publicUrl;
    }

    // Extract and chunk
    const chunks = await extractAndChunk(buffer, file.name);

    // Generate embeddings and store
    const vectorItems: VectorItem[] = [];
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);
      vectorItems.push({ chunk, embedding });
    }

    addChunks(vectorItems);

    return NextResponse.json({
      success: true,
      chunksCount: chunks.length,
      message: `Berhasil memproses ${chunks.length} bagian dari "${file.name}"`,
      fileUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses dokumen. Coba lagi.' },
      { status: 500 }
    );
  }
}
