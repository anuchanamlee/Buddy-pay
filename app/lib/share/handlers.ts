import type { RateLimiter } from '../rateLimit';
import { SHARE_ID_PATTERN, SHARE_LIMITS, shareBillSchema, type ShareDocument } from './schema';

/**
 * Logic ของ /api/share/create และ /api/share/[id]
 * แยกออกจาก route เพื่อทดสอบได้โดยไม่ต้องใช้ Firestore จริง
 */

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

// IP แรกใน x-forwarded-for คือ client ตามที่ reverse proxy (เช่น Vercel) กำหนด
// ถ้า deploy หลัง proxy ที่ไม่เขียนทับ header นี้ ผู้ใช้จะปลอม IP เพื่อหลบ rate limit ได้
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || 'unknown';
}

export type CreateShareDependencies = {
  saveShare: (shareId: string, doc: ShareDocument) => Promise<void>;
  generateShareId: () => string;
  rateLimiter: RateLimiter;
  appUrl: string;
  now?: () => Date;
  logError?: (message: string, meta?: Record<string, unknown>) => void;
};

export async function handleCreateShare(request: Request, deps: CreateShareDependencies): Promise<Response> {
  const rate = deps.rateLimiter.check(getClientIp(request));
  if (!rate.allowed) {
    return json(
      { error: 'สร้างลิงก์แชร์บ่อยเกินไป กรุณารอสักครู่' },
      429,
      { 'Retry-After': String(rate.retryAfterSeconds) },
    );
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > SHARE_LIMITS.maxBodyBytes) {
    return json({ error: 'ข้อมูลบิลมีขนาดใหญ่เกินกำหนด' }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400);
  }

  const parsed = shareBillSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'ข้อมูลบิลไม่สมบูรณ์หรือไม่ถูกต้อง' }, 400);
  }

  const now = deps.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + SHARE_LIMITS.ttlHours * 60 * 60 * 1000);
  const shareId = deps.generateShareId();

  const doc: ShareDocument = {
    ...parsed.data,
    shareId,
    createdAt: now.toISOString(),
    expiryDate: expiresAt.toISOString(),
    expiresAt,
    isTemporary: true,
    type: 'temp_share',
  };

  try {
    await deps.saveShare(shareId, doc);
  } catch (error) {
    // ไม่ log ข้อมูลบิล (มีชื่อคนและเลข PromptPay) log แค่ประเภทของ error
    deps.logError?.('failed to save share', { code: (error as { code?: unknown })?.code });
    return json({ error: 'ไม่สามารถสร้างลิงก์แชร์ได้ กรุณาลองใหม่อีกครั้ง' }, 500);
  }

  return json({
    success: true,
    shareUrl: `${deps.appUrl}/share/${shareId}`,
    shareId,
    expiryDate: doc.expiryDate,
    isTemporary: true,
  }, 200);
}

export type GetShareDependencies = {
  loadShare: (shareId: string) => Promise<Record<string, unknown> | null>;
  now?: () => Date;
  logError?: (message: string, meta?: Record<string, unknown>) => void;
};

// รองรับทั้งเอกสารใหม่ (expiresAt เป็น Timestamp) และเอกสารเก่า (มีแค่ expiryDate เป็น string)
function getExpiry(data: Record<string, unknown>): Date | null {
  const expiresAt = data.expiresAt as { toDate?: () => Date } | Date | undefined;
  if (expiresAt instanceof Date) return expiresAt;
  if (expiresAt && typeof expiresAt.toDate === 'function') return expiresAt.toDate();
  if (typeof data.expiryDate === 'string') {
    const parsed = new Date(data.expiryDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export async function handleGetShare(shareId: string, deps: GetShareDependencies): Promise<Response> {
  if (!SHARE_ID_PATTERN.test(shareId)) {
    return json({ error: 'ลิงก์ไม่ถูกต้อง' }, 400);
  }

  let data: Record<string, unknown> | null;
  try {
    data = await deps.loadShare(shareId);
  } catch (error) {
    deps.logError?.('failed to load share', { code: (error as { code?: unknown })?.code });
    return json({ error: 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง' }, 500);
  }

  if (!data) {
    return json({ error: 'ไม่พบลิงก์ที่ต้องการ หรือลิงก์อาจหมดอายุแล้ว' }, 404);
  }

  // ลิงก์หมดอายุ: ตอบ 410 โดยไม่ลบเอกสาร (Rules ไม่อนุญาตให้ลบ)
  // การลบจริงให้ใช้ TTL policy ของ Firestore บนฟิลด์ expiresAt
  const expiry = getExpiry(data);
  const now = deps.now?.() ?? new Date();
  if (!expiry || now >= expiry) {
    return json({ error: 'ลิงก์หมดอายุแล้ว' }, 410);
  }

  // ไม่ส่ง expiresAt (Timestamp) กลับไปเพราะ client ใช้ expiryDate อยู่แล้ว
  const { expiresAt: _expiresAt, ...publicData } = data;
  void _expiresAt;

  return json({
    success: true,
    data: publicData,
    expiryDate: data.expiryDate,
    createdAt: data.createdAt,
    isTemporary: data.isTemporary,
  }, 200);
}
