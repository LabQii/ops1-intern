-- SQL to create spinner_photos table
CREATE TABLE IF NOT EXISTS spinner_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,           -- Unique name used in the spinner
  image_url TEXT NOT NULL,             -- Public URL of the uploaded image
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_spinner_photos_name ON spinner_photos(name);

-- Enable Row Level Security (RLS)
ALTER TABLE spinner_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role (admin) full access
CREATE POLICY "Service role full access" ON spinner_photos
  FOR ALL USING (true) WITH CHECK (true);

-- Policy: Allow public read access (so the spinner page can show photos)
CREATE POLICY "Public read access" ON spinner_photos
  FOR SELECT USING (true);
