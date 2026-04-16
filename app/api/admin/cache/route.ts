import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

// Auth check helper
async function isAuthenticated(request?: NextRequest) {
  const cookieStore = await cookies();
  return cookieStore.get('ops1_admin')?.value === 'ops1-admin-authenticated-2025';
}

// GET - List all cached responses
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('response_cache')
    .select('id, question_key, original_question, response_text, audio_base64, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Don't send full audio_base64, just whether it exists
  const items = (data || []).map((item) => ({
    id: item.id,
    question_key: item.question_key,
    original_question: item.original_question,
    response_text: item.response_text,
    has_audio: !!item.audio_base64,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));

  return NextResponse.json({ success: true, items, total: items.length });
}

// DELETE - Delete a cache entry by id or all
export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all');

  if (all === 'true') {
    // Delete all entries
    const { error } = await supabaseAdmin
      .from('response_cache')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Semua cache dihapus' });
  }

  if (!id) {
    return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('response_cache')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Cache entry dihapus' });
}
