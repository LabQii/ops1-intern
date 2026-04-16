import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { error: 'Text tidak boleh kosong' },
        { status: 400 }
      );
    }

    const ttsText = text.slice(0, 3000);

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

    if (base64Chunks.length === 0) {
      return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
    }

    // Parse sample rate / bits from mimeType (e.g. "audio/L16;rate=24000")
    let sampleRate = 24000;
    let bitsPerSample = 16;

    if (mimeType) {
      const [fileType, ...params] = mimeType.split(';').map((s) => s.trim());
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

    const audioBuffers = base64Chunks.map((b64) => Buffer.from(b64, 'base64'));
    const rawPCM = Buffer.concat(audioBuffers);

    return NextResponse.json({
      audio: rawPCM.toString('base64'),
      sampleRate,
      bitsPerSample,
      numChannels: 1,
      mimeType,
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
