'use client';

import { useEffect, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Button } from '@/app/components/ui/Button';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { currentPushSubscription, pushSupported, subscribePush, subscriptionId, VAPID_PUBLIC_KEY } from '@/app/lib/pwa';

type State = 'checking' | 'unsupported' | 'not-configured' | 'denied' | 'off' | 'on' | 'working';

/** เปิด/ปิดแจ้งเตือนทวงเงินของเครื่องนี้ (เก็บ subscription ไว้ใน Firestore ให้ server ส่งแจ้งเตือน) */
export function NotificationToggle() {
  const { user } = useAuth();
  const [state, setState] = useState<State>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return setState('unsupported');
    if (!VAPID_PUBLIC_KEY) return setState('not-configured');
    if (Notification.permission === 'denied') return setState('denied');
    currentPushSubscription().then((s) => setState(s ? 'on' : 'off'), () => setState('off'));
  }, []);

  const enable = async () => {
    if (!user) return;
    setError(null);
    setState('working');
    try {
      const sub = await subscribePush();
      if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        setState(Notification.permission === 'denied' ? 'denied' : 'off');
        return;
      }
      await setDoc(doc(db, 'pushSubscriptions', await subscriptionId(sub.endpoint)), {
        userId: user.uid,
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setState('on');
    } catch (e) {
      console.error('enable notifications failed', e);
      setError('เปิดแจ้งเตือนไม่สำเร็จ ลองอีกครั้ง');
      setState('off');
    }
  };

  const disable = async () => {
    setError(null);
    setState('working');
    try {
      const sub = await currentPushSubscription();
      if (sub) {
        await deleteDoc(doc(db, 'pushSubscriptions', await subscriptionId(sub.endpoint))).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState('off');
    } catch (e) {
      console.error('disable notifications failed', e);
      setError('ปิดแจ้งเตือนไม่สำเร็จ ลองอีกครั้ง');
      setState('on');
    }
  };

  if (state === 'checking') return null;
  if (state === 'unsupported') return <p className="text-sm text-muted-foreground">เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน</p>;
  if (state === 'not-configured') return <p className="text-sm text-muted-foreground">ระบบแจ้งเตือนยังไม่ได้ตั้งค่าบนเว็บนี้</p>;
  if (state === 'denied') {
    return (
      <p className="text-sm text-muted-foreground">
        เครื่องนี้ปิดการแจ้งเตือนของ BuddyPay ไว้ เปิดได้ที่การตั้งค่าของเครื่อง → การแจ้งเตือน → BuddyPay
      </p>
    );
  }
  return (
    <div>
      {state === 'on' ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-success-700">เปิดแจ้งเตือนแล้ว ทุกเย็นราว 6 โมง</span>
          <Button variant="outline" onClick={disable}>
            ปิดแจ้งเตือน
          </Button>
        </div>
      ) : (
        <Button onClick={enable} isLoading={state === 'working'} loadingText="กำลังเปิด">
          เปิดตัวเลขบนไอคอนและแจ้งเตือน
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
