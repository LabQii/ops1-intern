import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function isAuthenticated(req: NextRequest) {
  return req.cookies.get('ops1_admin')?.value === 'ops1-admin-authenticated-2025';
}

// Public GET — spinner page can fetch without auth
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('spinner_photos')
    .select('name, image_url');

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  // Return as a simple map { name: image_url }
  const photoMap: Record<string, string> = {};
  for (const row of data ?? []) {
    photoMap[row.name] = row.image_url;
  }

  return NextResponse.json({ success: true, photos: photoMap });
}

// POST — upload/replace photo for a person
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;

    if (!file || !name) {
      return NextResponse.json({ success: false, message: 'Missing file or name' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'Hanya JPG, PNG, WebP, atau GIF yang didukung' }, { status: 400 });
    }

    const ext = file.name.split('.').pop();
    const fileName = `${name.toLowerCase()}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Delete existing file for this name if any
    const { data: existing } = await supabaseAdmin
      .from('spinner_photos')
      .select('image_url')
      .eq('name', name)
      .single();

    if (existing?.image_url) {
      const oldPath = existing.image_url.split('/').pop();
      if (oldPath) {
        await supabaseAdmin.storage.from('spinner-photos').remove([oldPath]);
      }
    }

    // Upload new file
    const { error: storageError } = await supabaseAdmin.storage
      .from('spinner-photos')
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (storageError) throw storageError;

    const { data: urlData } = supabaseAdmin.storage
      .from('spinner-photos')
      .getPublicUrl(fileName);

    // Upsert DB record
    const { error: dbError } = await supabaseAdmin
      .from('spinner_photos')
      .upsert({ name, image_url: urlData.publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'name' });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, image_url: urlData.publicUrl });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Upload failed' }, { status: 500 });
  }
}

// DELETE — remove photo for a person
export async function DELETE(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) return NextResponse.json({ success: false, message: 'Missing name' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('spinner_photos')
      .select('image_url')
      .eq('name', name)
      .single();

    if (existing?.image_url) {
      const oldPath = existing.image_url.split('/').pop();
      if (oldPath) {
        await supabaseAdmin.storage.from('spinner-photos').remove([oldPath]);
      }
    }

    await supabaseAdmin.from('spinner_photos').delete().eq('name', name);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Delete failed' }, { status: 500 });
  }
}
