import { supabaseAdmin } from '@/lib/supabase';

export interface CachedResponse {
  id: string;
  question_key: string;
  original_question: string;
  response_text: string;
  audio_base64: string | null;
  audio_sample_rate: number;
  audio_bits_per_sample: number;
  audio_mime_type: string | null;
}

// Normalize question for cache lookup
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:'"()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// In-memory index for fuzzy matching (loaded once on startup)
let questionKeys: string[] = [];
let keysLoaded = false;

async function loadQuestionKeys() {
  if (keysLoaded) return;
  const { data } = await supabaseAdmin
    .from('response_cache')
    .select('question_key');
  questionKeys = data?.map((r) => r.question_key) || [];
  keysLoaded = true;
}

function findSimilarKey(normalized: string): string | null {
  for (const key of questionKeys) {
    // Exact match
    if (key === normalized) return key;

    // Contains match
    if (normalized.includes(key) || key.includes(normalized)) {
      if (Math.abs(normalized.length - key.length) < 10) return key;
    }

    // Word-overlap similarity
    const wordsA = new Set(normalized.split(' '));
    const wordsB = new Set(key.split(' '));
    const intersection = [...wordsA].filter((w) => wordsB.has(w));
    const similarity = (intersection.length * 2) / (wordsA.size + wordsB.size);
    if (similarity > 0.75 && wordsA.size > 1) return key;
  }

  return null;
}

// --- Public API ---

export async function getCachedResponse(question: string): Promise<CachedResponse | null> {
  await loadQuestionKeys();

  const normalized = normalizeQuestion(question);
  const matchKey = findSimilarKey(normalized);

  if (!matchKey) return null;

  const { data, error } = await supabaseAdmin
    .from('response_cache')
    .select('*')
    .eq('question_key', matchKey)
    .single();

  if (error || !data) return null;

  console.log('Cache HIT (DB):', matchKey);
  return data as CachedResponse;
}

export async function saveResponse(
  question: string,
  responseText: string
): Promise<string> {
  const normalized = normalizeQuestion(question);

  const { data, error } = await supabaseAdmin
    .from('response_cache')
    .upsert(
      {
        question_key: normalized,
        original_question: question.trim(),
        response_text: responseText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'question_key' }
    )
    .select('id')
    .single();

  if (error) {
    console.error('Cache save error:', error);
    throw error;
  }

  // Update in-memory key index
  if (!questionKeys.includes(normalized)) {
    questionKeys.push(normalized);
  }

  console.log('Cache SAVED (DB):', normalized);
  return data.id;
}

export async function saveAudio(
  questionKey: string,
  audioBase64: string,
  sampleRate: number,
  bitsPerSample: number,
  mimeType: string
): Promise<void> {
  const normalized = normalizeQuestion(questionKey);

  const { error } = await supabaseAdmin
    .from('response_cache')
    .update({
      audio_base64: audioBase64,
      audio_sample_rate: sampleRate,
      audio_bits_per_sample: bitsPerSample,
      audio_mime_type: mimeType,
      updated_at: new Date().toISOString(),
    })
    .eq('question_key', normalized);

  if (error) {
    console.error('Audio cache save error:', error);
  } else {
    console.log('Audio SAVED (DB):', normalized);
  }
}

export async function getCachedAudio(
  responseText: string
): Promise<{ audio_base64: string; audio_sample_rate: number; audio_bits_per_sample: number; audio_mime_type: string } | null> {
  // Find by response text
  const { data, error } = await supabaseAdmin
    .from('response_cache')
    .select('audio_base64, audio_sample_rate, audio_bits_per_sample, audio_mime_type')
    .eq('response_text', responseText)
    .not('audio_base64', 'is', null)
    .single();

  if (error || !data || !data.audio_base64) return null;

  console.log('Audio cache HIT (DB)');
  return data;
}
