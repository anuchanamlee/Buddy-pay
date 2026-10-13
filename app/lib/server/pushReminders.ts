// ส่งแจ้งเตือนทวงเงินรายวัน (ทำงานฝั่ง server เท่านั้น เรียกจาก /api/cron/reminders)
//
// ต้องตั้ง environment variables บน hosting (ห้าม commit ค่าเหล่านี้):
//   FIREBASE_SERVICE_ACCOUNT        JSON ของ service account (ความลับ)
//   VAPID_PRIVATE_KEY               คีย์ส่วนตัวของ Web Push (ความลับ)
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY    คีย์สาธารณะคู่กัน
//   VAPID_SUBJECT                   เช่น mailto:you@example.com
//   CRON_SECRET                     Vercel ส่งมาใน header ตอนเรียก cron
import { reminderMessage, summarizePending } from '@/app/lib/reminders';

export const MAX_SUBSCRIPTIONS = 500;
const MAX_BILLS_PER_USER = 50;

export function missingPushConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  return ['FIREBASE_SERVICE_ACCOUNT', 'VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_SUBJECT', 'CRON_SECRET'].filter(
    (k) => !env[k],
  );
}

type SubDoc = { userId?: string; endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function sendDailyReminders(): Promise<{ users: number; sent: number; removed: number; failed: number }> {
  const [{ cert, getApps, initializeApp }, { getFirestore }, webpushModule] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
    import('web-push'),
  ]);
  const webpush = webpushModule.default;

  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string)) });
  }
  const db = getFirestore();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );

  const subsSnap = await db.collection('pushSubscriptions').limit(MAX_SUBSCRIPTIONS).get();
  const byUser = new Map<string, Array<{ ref: FirebaseFirestore.DocumentReference; sub: SubDoc }>>();
  subsSnap.forEach((doc) => {
    const sub = doc.data() as SubDoc;
    if (!sub.userId || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
    const list = byUser.get(sub.userId) || [];
    list.push({ ref: doc.ref, sub });
    byUser.set(sub.userId, list);
  });

  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const [userId, subs] of Array.from(byUser.entries())) {
    const bills = await db
      .collection('bills')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .limit(MAX_BILLS_PER_USER)
      .get();
    const summary = summarizePending(bills.docs.map((d) => d.data()));
    const message = reminderMessage(summary);
    if (!message) continue; // ไม่มีใครค้าง ไม่รบกวน

    const payload = JSON.stringify({ ...message, url: '/bill-history', badge: summary.pendingCount, tag: 'buddypay-reminder' });
    for (const { ref, sub } of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint as string, keys: { p256dh: sub.keys!.p256dh as string, auth: sub.keys!.auth as string } },
          payload,
          { TTL: 12 * 60 * 60 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = ผู้ใช้ยกเลิกหรือลบแอปไปแล้ว ลบทิ้งไม่ส่งอีก
        if (status === 404 || status === 410) {
          await ref.delete().catch(() => undefined);
          removed++;
        } else {
          failed++;
        }
      }
    }
  }
  return { users: byUser.size, sent, removed, failed };
}
