-- Create response cache table for storing AI text responses and TTS audio
CREATE TABLE IF NOT EXISTS response_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_key TEXT NOT NULL UNIQUE,       -- normalized question
  original_question TEXT NOT NULL,          -- original question text
  response_text TEXT NOT NULL,              -- AI response text
  audio_base64 TEXT,                        -- base64 encoded PCM audio (Gemini TTS)
  audio_sample_rate INTEGER DEFAULT 24000,
  audio_bits_per_sample INTEGER DEFAULT 16,
  audio_mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_response_cache_question_key ON response_cache(question_key);

-- Enable RLS (but allow service role full access)
ALTER TABLE response_cache ENABLE ROW LEVEL SECURITY;

-- Policy: service role can do everything
CREATE POLICY "Service role full access" ON response_cache
  FOR ALL USING (true) WITH CHECK (true);
