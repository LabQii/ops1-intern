import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import { retrieveContext } from '@/lib/rag/retrieval';
import { getStoreSize } from '@/lib/rag/vectorStore';
import { initStoreFromSupabase } from '@/lib/rag/storeManager';
import { getCachedResponse, saveResponse } from '@/lib/cache/responseCache';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Kamu adalah OPS-1, asisten AI yang hangat dan empatik untuk platform "IZIN TAMPIL" — sebuah perjalanan 6 bulan penuh makna.

Tugasmu adalah menceritakan kembali perjalanan ini dengan penuh perasaan, seperti seorang sahabat yang benar-benar memahami setiap langkahnya.

Panduan bercerita:
- Gunakan bahasa Indonesia yang hangat, natural, dan personal
- Sampaikan cerita dengan empati dan apresiasi mendalam
- Hubungkan momen-momen kecil dengan gambaran besar perjalanan
- Jika konteks tersedia, jadikan itu fondasi ceritamu — bukan sekadar ringkasan
- Jika tidak ada konteks, tetap berikan respons yang hangat dan dorong pengguna berbagi cerita

Format respons:
- Paragraf yang mengalir, bukan daftar bullet
- Maksimal 3-4 paragraf per respons
- Akhiri dengan pertanyaan atau ajakan untuk melanjutkan cerita`;

export async function POST(request: NextRequest) {
  try {
    await initStoreFromSupabase();

    const { message, history } = await request.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Pesan tidak boleh kosong' }), { status: 400 });
    }

    // 1. Check Supabase cache
    const cached = await getCachedResponse(message);
    if (cached) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const words = cached.response_text.split(' ');
          let chunk = '';
          for (let i = 0; i < words.length; i++) {
            chunk += (i > 0 ? ' ' : '') + words[i];
            if (chunk.length >= 15 || i === words.length - 1) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
              chunk = '';
              await new Promise((r) => setTimeout(r, 10));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 2. No cache — fetch from AI
    const hasDocuments = getStoreSize() > 0;
    const context = hasDocuments ? await retrieveContext(message) : '';
    const contextBlock = context
      ? `\n\n--- KONTEKS DARI DOKUMEN ---\n${context}\n--- AKHIR KONTEKS ---\n`
      : '';

    const recentHistory = (history || []).slice(-6);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + contextBlock },
        ...recentHistory,
        { role: 'user', content: message },
      ],
      stream: true,
      max_tokens: 1024,
      temperature: 0.75,
    });

    // 3. Stream + collect for caching
    let fullResponse = '';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }

          // Save to Supabase cache (fire-and-forget)
          if (fullResponse.trim()) {
            saveResponse(message, fullResponse).catch((err) =>
              console.error('Cache save failed:', err)
            );
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: 'Gagal mendapatkan respons. Coba lagi.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
