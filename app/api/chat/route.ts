import OpenAI from 'openai';
import { handleChatRequest } from '@/app/lib/chat/handler';
import { isAiChatEnabled } from '@/app/lib/chat/featureFlag';
import { createRateLimiter } from '@/app/lib/chat/rateLimit';
import { CHAT_SYSTEM_PROMPT } from '@/app/lib/chat/systemPrompt';
import { verifyFirebaseIdToken } from '@/app/lib/server/firebaseAdmin';

// ต้องรันบน Node.js runtime เพราะใช้ firebase-admin
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 10 ข้อความต่อนาทีต่อผู้ใช้ (นับแยกตาม server instance)
const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

let openaiClient: OpenAI | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export async function POST(request: Request) {
  // OPENAI_API_KEY ไม่มี prefix NEXT_PUBLIC_ จึงไม่ถูกฝังลงใน JavaScript ของ browser
  const apiKey = process.env.OPENAI_API_KEY;

  return handleChatRequest(request, {
    // ต้องเปิด flag และมี key ครบทั้งคู่ ถ้าไม่ครบตอบ 503 โดยไม่ตรวจ token และไม่เรียก OpenAI
    isEnabled: isAiChatEnabled() && Boolean(apiKey),
    verifyIdToken: verifyFirebaseIdToken,
    rateLimiter,
    createReply: async (messages) => {
      const completion = await getOpenAIClient(apiKey as string).chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages],
        max_tokens: 600,
      });
      return completion.choices[0]?.message?.content || 'ไม่มีข้อความตอบกลับ';
    },
    logError: (message, meta) => {
      console.error(`[api/chat] ${message}`, meta);
    },
  });
}
