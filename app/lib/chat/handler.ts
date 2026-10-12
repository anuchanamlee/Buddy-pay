import { CHAT_LIMITS, chatRequestSchema, type ChatMessage } from './validation';
import type { RateLimiter } from './rateLimit';

/**
 * Logic ของ POST /api/chat แยกออกจาก route เพื่อให้ทดสอบได้โดยไม่ต้องใช้
 * Firebase หรือ OpenAI จริง (ส่ง dependency ปลอมเข้ามาใน test แทน)
 */
export type ChatDependencies = {
  // true เมื่อ server มี OPENAI_API_KEY (ไม่ส่งค่า key เข้ามาใน handler)
  isEnabled: boolean;
  verifyIdToken: (idToken: string) => Promise<{ uid: string }>;
  createReply: (messages: ChatMessage[]) => Promise<string>;
  rateLimiter: RateLimiter;
  logError?: (message: string, meta?: Record<string, unknown>) => void;
};

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function handleChatRequest(request: Request, deps: ChatDependencies): Promise<Response> {
  // 1) ปิดแชทบอทเมื่อ server ไม่มี API key แทนที่จะพังหรือรั่ว key
  if (!deps.isEnabled) {
    return json({ error: 'chatbot_disabled', message: 'แชทบอทยังไม่เปิดใช้งาน' }, 503);
  }

  // 2) ต้องล็อกอินด้วย Firebase ID token
  const idToken = getBearerToken(request);
  if (!idToken) {
    return json({ error: 'unauthorized', message: 'กรุณาเข้าสู่ระบบก่อนใช้งานแชทบอท' }, 401);
  }

  let uid: string;
  try {
    ({ uid } = await deps.verifyIdToken(idToken));
  } catch (error) {
    // token ไม่ถูกต้องเป็นเรื่องปกติ แต่ถ้าเป็น error อื่น (เช่นยังไม่ตั้ง project ID) ให้ log ไว้
    const code = (error as { code?: unknown })?.code;
    if (typeof code !== 'string' || !code.startsWith('auth/')) {
      deps.logError?.('token verification failed', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
    return json({ error: 'unauthorized', message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }, 401);
  }

  // 3) จำกัดจำนวนครั้งต่อผู้ใช้ เพื่อควบคุมค่าใช้จ่าย OpenAI
  const rate = deps.rateLimiter.check(uid);
  if (!rate.allowed) {
    return json(
      { error: 'rate_limited', message: 'ส่งข้อความถี่เกินไป กรุณารอสักครู่' },
      429,
      { 'Retry-After': String(rate.retryAfterSeconds) },
    );
  }

  // 4) ตรวจขนาดและรูปแบบของ body
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > CHAT_LIMITS.maxBodyBytes) {
    return json({ error: 'payload_too_large', message: 'ข้อความยาวเกินกำหนด' }, 413);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid_request', message: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400);
  }

  const parsed = chatRequestSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return json({ error: 'invalid_request', message: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400);
  }

  // 5) เรียกโมเดล — log เฉพาะข้อมูลที่ไม่ใช่ความลับ (ไม่ log key, token หรือเนื้อหาแชท)
  try {
    const reply = await deps.createReply(parsed.data.messages);
    return json({ reply }, 200);
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : undefined;
    deps.logError?.('chat completion failed', { uid, upstreamStatus: status });
    return json({ error: 'upstream_error', message: 'ไม่สามารถติดต่อแชทบอทได้ในขณะนี้' }, 502);
  }
}
