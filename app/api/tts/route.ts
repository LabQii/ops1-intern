import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getCachedAudio, saveAudio } from '@/lib/cache/responseCache';
import { geminiKeys } from '@/lib/apiKeys';

function createAI(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

async function generateTTS(apiKey: string, ttsText: string) {
  const ai = createAI(apiKey);

  const response = await ai.models.generateContentStream({
    model: 'gemini-3.1-flash-tts-preview',
    config: {
      temperature: 1,
      responseModalities: ['audio'] as const,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Achird',
          },
        },
      },
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: ttsText }],
      },
    ],
  });

  const base64Chunks: string[] = [];
  let mimeType = '';

  for await (const chunk of response) {
    if (!chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) continue;
    const inlineData = chunk.candidates[0].content.parts[0].inlineData;
    if (!mimeType && inlineData.mimeType) mimeType = inlineData.mimeType;
    if (inlineData.data) base64Chunks.push(inlineData.data);
  }

  return { base64Chunks, mimeType };
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text tidak boleh kosong' }, { status: 400 });
    }

    // 1. Check Supabase audio cache
    const cachedAudio = await getCachedAudio(text);
    if (cachedAudio) {
      console.log('TTS cache HIT (DB)');
      return NextResponse.json({
        audio: cachedAudio.audio_base64,
        sampleRate: cachedAudio.audio_sample_rate,
        bitsPerSample: cachedAudio.audio_bits_per_sample,
        numChannels: 1,
        mimeType: cachedAudio.audio_mime_type || '',
      });
    }

    // 2. Generate from Gemini with key rotation
    const ttsText = text.slice(0, 3000);
    let result: { base64Chunks: string[]; mimeType: string } | null = null;

    // Try current key, rotate on 429
    let currentKey = geminiKeys.getCurrentKey();
    try {
      result = await generateTTS(currentKey, ttsText);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('429') || errMsg.includes('Too Many Requests')) {
        console.warn('Gemini 429 on current key, rotating...');
        const nextKey = geminiKeys.rotateOnRateLimit();
        if (nextKey) {
          result = await generateTTS(nextKey, ttsText);
        } else {
          return NextResponse.json(
            { error: 'Semua API key terkena rate limit. Coba lagi nanti.' },
            { status: 429 }
          );
        }
      } else {
        throw err;
      }
    }

    if (!result || result.base64Chunks.length === 0) {
      return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
    }

    // Parse audio params
    let sampleRate = 24000;
    let bitsPerSample = 16;

    if (result.mimeType) {
      const [fileType, ...params] = result.mimeType.split(';').map((s) => s.trim());
      const [, format] = fileType.split('/');
      if (format?.startsWith('L')) {
        const bits = parseInt(format.slice(1), 10);
        if (!isNaN(bits)) bitsPerSample = bits;
      }
      for (const param of params) {
        const [key, value] = param.split('=').map((s) => s.trim());
        if (key === 'rate') sampleRate = parseInt(value, 10);
      }
    }

    const audioBuffers = result.base64Chunks.map((b64) => Buffer.from(b64, 'base64'));
    const rawPCM = Buffer.concat(audioBuffers);
    const audioBase64 = rawPCM.toString('base64');

    // 3. Save audio to Supabase cache (fire-and-forget)
    saveAudioForText(text, audioBase64, sampleRate, bitsPerSample, result.mimeType);

    return NextResponse.json({
      audio: audioBase64,
      sampleRate,
      bitsPerSample,
      numChannels: 1,
      mimeType: result.mimeType,
    });
  } catch (error) {
    console.error('TTS error:', error);
    const msg = error instanceof Error ? error.message : '';
    const status = msg.includes('429') ? 429 : 500;
    return NextResponse.json(
      { error: status === 429 ? 'Rate limited' : 'TTS failed' },
      { status }
    );
  }
}

// Save audio linked to the response text in cache
async function saveAudioForText(
  responseText: string,
  audioBase64: string,
  sampleRate: number,
  bitsPerSample: number,
  mimeType: string
) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase');
    const { data } = await supabaseAdmin
      .from('response_cache')
      .select('question_key')
      .eq('response_text', responseText)
      .single();

    if (data?.question_key) {
      await saveAudio(data.question_key, audioBase64, sampleRate, bitsPerSample, mimeType);
    } else {
      console.log('TTS: no matching cache entry for audio save');
    }
  } catch (err) {
    console.error('TTS audio save failed:', err);
  }
}
