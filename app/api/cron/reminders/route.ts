import { NextResponse } from 'next/server';
import { missingPushConfig, sendDailyReminders } from '@/app/lib/server/pushReminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Cron เรียกวันละครั้ง (ดู vercel.json) พร้อม header Authorization: Bearer <CRON_SECRET>
export async function GET(request: Request) {
  const missing = missingPushConfig();
  if (missing.length > 0) {
    // ยังไม่ได้ตั้งค่าการแจ้งเตือน: ไม่ทำอะไร (ไม่บอกชื่อตัวแปรให้คนนอกเห็น)
    return NextResponse.json({ ok: false, error: 'push reminders are not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await sendDailyReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('daily reminders failed', error);
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 });
  }
}
