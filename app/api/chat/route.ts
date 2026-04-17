import { NextRequest } from 'next/server';

export const maxDuration = 60;
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { retrieveContext } from '@/lib/rag/retrieval';
import { getStoreSize } from '@/lib/rag/vectorStore';
import { initStoreFromSupabase } from '@/lib/rag/storeManager';
import { getCachedResponse, saveResponse } from '@/lib/cache/responseCache';
import { groqKeys, geminiKeys } from '@/lib/apiKeys';

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

// ── Groq streaming — returns null if all keys are rate-limited ───────────────
async function tryGroqStream(
  messages: any[],
  systemPrompt: string
): Promise<AsyncIterable<any> | null> {
  let attempts = groqKeys.getKeyCount();
  while (attempts > 0) {
    const currentKey = groqKeys.getCurrentKey();
    const groq = new Groq({ apiKey: currentKey });
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
        max_tokens: 2048,
        temperature: 0.88,
      });
      console.log('Using Groq for inference');
      return completion;
    } catch (err: any) {
      const status = err?.status;
      const errMsg = err?.message || String(err);
      const is429 =
        status === 429 ||
        errMsg.includes('429') ||
        errMsg.includes('Too Many Requests') ||
        errMsg.includes('rate_limit_exceeded');
      if (is429) {
        console.warn('Groq 429, rotating key...');
        groqKeys.rotateOnRateLimit();
        attempts--;
        if (attempts <= 0) {
          console.warn('All Groq keys exhausted, falling back to Gemini...');
          return null;
        }
      } else {
        throw err;
      }
    }
  }
  return null;
}

// ── Gemini streaming fallback ────────────────────────────────────────────────
async function geminiStream(
  messages: any[],
  systemPrompt: string
): Promise<AsyncIterable<string>> {
  let attempts = geminiKeys.getKeyCount();
  while (attempts > 0) {
    const key = geminiKeys.getCurrentKey();
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });

    // Convert Groq-style history to Gemini format
    const geminiHistory = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastMsg = messages[messages.length - 1];

    try {
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessageStream(lastMsg.content);
      console.log('Using Gemini as fallback for inference');
      return (async function* () {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) yield text;
        }
      })();
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('429') || errMsg.includes('Too Many Requests')) {
        console.warn('Gemini 429, rotating key...');
        geminiKeys.rotateOnRateLimit();
        attempts--;
        if (attempts <= 0) throw new Error('All Gemini keys rate limited');
      } else {
        throw err;
      }
    }
  }
  throw new Error('All LLM keys exhausted');
}

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
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      });
    }

    // 2. Build context
    const hasDocuments = getStoreSize() > 0;
    const context = hasDocuments ? await retrieveContext(message) : '';
    const contextBlock = context
      ? `\n\n--- KONTEKS DARI DOKUMEN ---\n${context}\n--- AKHIR KONTEKS ---\n`
      : '';
    const fullSystemPrompt = SYSTEM_PROMPT + contextBlock;

    const recentHistory = (history || []).slice(-6);
    const chatMessages = [
      ...recentHistory,
      { role: 'user', content: message },
    ];

    // 3. Try Groq first, fallback to Gemini
    const groqCompletion = await tryGroqStream(chatMessages, fullSystemPrompt);

    let fullResponse = '';
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (groqCompletion) {
            // ── Groq path ──
            for await (const chunk of groqCompletion) {
              const text = chunk.choices[0]?.delta?.content || '';
              if (text) {
                fullResponse += text;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            }
          } else {
            // ── Gemini fallback path ──
            const geminiIter = await geminiStream(chatMessages, fullSystemPrompt);
            for await (const text of geminiIter) {
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }

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
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: 'Gagal mendapatkan respons. Coba lagi.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
