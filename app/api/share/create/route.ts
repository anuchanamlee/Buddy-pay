import crypto from 'crypto';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { createRateLimiter } from '@/app/lib/rateLimit';
import { handleCreateShare } from '@/app/lib/share/handlers';

export const runtime = 'nodejs';

// สร้างลิงก์ได้ 10 ครั้งต่อ 10 นาทีต่อ IP (นับแยกตาม server instance)
const rateLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  // ยังไม่ได้ตั้งค่า Firebase: ตอบ 503 แทนการพยายามเขียนแล้วพัง
  if (!db) {
    return Response.json({ error: 'ระบบแชร์บิลยังไม่พร้อมใช้งาน' }, { status: 503 });
  }

  return handleCreateShare(request, {
    rateLimiter,
    // 128 บิตแบบสุ่ม เดาไม่ได้ (ลิงก์ทำหน้าที่เป็นรหัสผ่านในการเข้าถึงบิล)
    generateShareId: () => crypto.randomBytes(16).toString('hex'),
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://buddypay.vercel.app',
    saveShare: async (shareId, data) => {
      await setDoc(doc(db, 'temporary_shared_bills', shareId), data);
    },
    logError: (message, meta) => console.error(`[api/share/create] ${message}`, meta),
  });
}
