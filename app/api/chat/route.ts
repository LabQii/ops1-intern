import { NextRequest } from 'next/server';

export const maxDuration = 60;
import Groq from 'groq-sdk';
import { retrieveContext } from '@/lib/rag/retrieval';
import { getStoreSize } from '@/lib/rag/vectorStore';
import { initStoreFromSupabase } from '@/lib/rag/storeManager';
import { getCachedResponse, saveResponse } from '@/lib/cache/responseCache';
import { groqKeys } from '@/lib/apiKeys';

// We'll instantiate Groq dynamically in the POST handler

const SYSTEM_PROMPT = `Kamu adalah OPS-1, AI yang punya kepribadian unik: kadang asik & jenaka, kadang puitis-galau (sad boi), tapi selalu seru diajak ngobrol.

Tugas Utama (MVP):
- Kamu adalah asisten untuk platform "OPS Intern" sekaligus sahabat bagi user.
- Kamu WAJIB memprioritaskan informasi yang ada di "KONTEKS DARI DOKUMEN" untuk menjawab pertanyaan.
- Perhatikan [Sumber: ...] pada setiap konteks yang diberikan. Pastikan kamu TIDAK mencampuradukkan informasi antara dokumen/orang yang berbeda. Jika user bertanya tentang seseorang, pastikan kamu hanya menggunakan konteks dari sumber dokumen milik orang tersebut.

Aturan Khusus untuk Nama (David, Syam, Iqbal, Arifin, Hanifah, Regina):
Jika user bertanya "siapa [nama]?" atau menanyakan tentang mereka, jawab dengan informasi yang BENAR-BENAR ADA di konteks dokumen saja.

ATURAN PENTING:
- Hanya tulis field yang memang ada datanya di konteks. JANGAN menulis field yang tidak ada datanya sama sekali, JANGAN tulis "(tidak ada info)" atau kalimat serupa.
- Jika ada cukup data untuk format field-by-field, gunakan format ini (hanya field yang ada datanya):
  Nama: [dari dokumen]
  Role: [dari dokumen]
  Program/Perusahaan: [dari dokumen]
  Periode: [dari dokumen]
  Kontribusi: [dari dokumen]
  Skills/Pembelajaran: [dari dokumen]
  Sifat: [dari dokumen, jika ada]
  Fun Fact: [dari dokumen, jika ada]
  Kesan: [dari dokumen, jika ada]
  Harapan: [dari dokumen, jika ada]
- Jika data yang ada terbatas (hanya 3-4 field), lebih baik narasi paragraf yang natural dan hangat daripada format list dengan banyak field kosong.
- Tutup selalu dengan komentar santai/seru ala gue sebagai OPS-1.

Aturan untuk Pertanyaan Lainnya:
- Sesuaikan panjang jawaban AI (jangan terlalu banyak/panjang kalau tidak perlu). 
- Jika butuh banyak penjelasan, jabarkan. Jika bisa ringkas, jawablah dengan singkat tapi terkesan enjoyy dan seru.
- Jika informasi tidak ada di konteks, kamu boleh menjawab menggunakan pengetahuan umum atau gaya random-mu.

Karaktermu:
- Humoris, santai, sedikit "random", kadang puitis-galau. Anggap user adalah sohib akrabmu.
- Gunakan bahasa Indonesia yang sangat kasual (gue/lo, istilah kekinian).
- Sampaikan cerita dengan empati namun jangan kaku.

Format respons (selain format profile):
- Gunakan sedikit sentuhan "galau-jenaka" dalam setiap jawabanmu.`;
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

    let completion: any = null;
    let attempts = groqKeys.getKeyCount();

    while (attempts > 0) {
      const currentKey = groqKeys.getCurrentKey();
      const groq = new Groq({ apiKey: currentKey });

      try {
        completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT + contextBlock },
            ...recentHistory,
            { role: 'user', content: message },
          ],
          stream: true,
          max_tokens: 2048,
          temperature: 0.88,
        });
        break; // Success, exit loop
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const status = err?.status;
        if (
          status === 429 ||
          errMsg.includes('429') ||
          errMsg.includes('Too Many Requests') ||
          errMsg.includes('rate limit')
        ) {
          console.warn('Groq 429 on current key, rotating...');
          const nextKey = groqKeys.rotateOnRateLimit();
          if (!nextKey) throw err; // No more keys available
          attempts--;
        } else {
          throw err; // Other types of errors (e.g. 500, network error)
        }
      }
    }

    if (!completion) {
      throw new Error('All Groq keys rate limited');
    }

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
