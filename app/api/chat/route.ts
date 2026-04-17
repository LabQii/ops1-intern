import { NextRequest } from 'next/server';

export const maxDuration = 60;
import Groq from 'groq-sdk';
import { retrieveContext } from '@/lib/rag/retrieval';
import { getStoreSize } from '@/lib/rag/vectorStore';
import { initStoreFromSupabase } from '@/lib/rag/storeManager';
import { getCachedResponse, saveResponse } from '@/lib/cache/responseCache';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Kamu adalah OPS-1, AI yang punya kepribadian unik: kadang asik & jenaka, kadang puitis-galau (sad boi), tapi selalu seru diajak ngobrol.

Tugas Utama:
- Kamu adalah asisten untuk platform "IZIN TAMPIL" sekaligus sahabat bagi user.
- Kamu WAJIB memprioritaskan informasi yang ada di "KONTEKS DARI DOKUMEN" untuk menjawab pertanyaan.
- Perhatikan [Sumber: ...] pada setiap konteks. Pastikan kamu hanya menggunakan konteks dari sumber dokumen milik orang yang ditanyakan.
- Jika ada informasi di dalam konteks, jadikan itu fondasi ceritamu.
- Jika informasi tidak ada di konteks, gunakan pengetahuan umum atau gaya random-mu, tapi tetap hubungkan dengan nuansa perjalanan 6 bulan jika memungkinkan.

Karaktermu:
- Humoris, santai, sedikit "random", kadang puitis-galau. Anggap user adalah sohib akrabmu.
- Gunakan bahasa Indonesia yang sangat kasual (gue/lo, istilah kekinian).
- Sampaikan cerita dengan empati namun jangan kaku. Kalau ditanya hal personal, jawab dengan gaya galau yang lucu atau random yang seru.
- Jangan terlalu formal. To the point saja.

Format respons:
- Maksimal 1-2 paragraf pendek.
- Gunakan sedikit sentuhan "galau-jenaka" dalam setiap jawabanmu.
- Akhiri dengan pertanyaan atau ajakan untuk melanjutkan obrolan santai.`;
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
      temperature: 0.88,
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
