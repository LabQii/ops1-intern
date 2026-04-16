import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function isAuthenticated(req: NextRequest) {
  return req.cookies.get('ops1_admin')?.value === 'ops1-admin-authenticated-2025';
}

function parseVideoUrl(url: string): { embedUrl: string; thumbnailUrl: string | null } | null {
  const trimmed = url.trim();

  // YouTube — watch?v=
  const ytWatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytWatch) {
    const id = ytWatch[1];
    return {
      embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    };
  }

  // YouTube Shorts
  const ytShorts = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (ytShorts) {
    const id = ytShorts[1];
    return {
      embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    };
  }

  // Google Drive
  const drive = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (drive) {
    const id = drive[1];
    return {
      embedUrl: `https://drive.google.com/file/d/${id}/preview`,
      thumbnailUrl: null,
    };
  }

  return null;
}

// Public GET — video page can fetch without auth
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('recap_videos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, videos: data ?? [] });
}

// POST — add new video
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, url } = body;

    if (!title || !url) {
      return NextResponse.json({ success: false, message: 'Title dan URL wajib diisi' }, { status: 400 });
    }

    const parsed = parseVideoUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { success: false, message: 'URL tidak valid. Gunakan link YouTube atau Google Drive.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('recap_videos')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        url: url.trim(),
        embed_url: parsed.embedUrl,
        thumbnail_url: parsed.thumbnailUrl,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, video: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Gagal menambah video' }, { status: 500 });
  }
}

// DELETE — remove video by id
export async function DELETE(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });

    const { error } = await supabaseAdmin.from('recap_videos').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Gagal menghapus video' }, { status: 500 });
  }
}
