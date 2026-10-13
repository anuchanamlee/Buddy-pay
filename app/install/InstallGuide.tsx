'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Download, Plus, Share, Smartphone, Zap } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { useAuth } from '@/app/context/AuthContext';
import { useAuthModal } from '@/app/context/AuthModalContext';
import { isIOS, isStandalone } from '@/app/lib/pwa';
import { NotificationToggle } from './NotificationToggle';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {n}
      </span>
      <span className="pt-0.5 text-foreground">{children}</span>
    </li>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function InstallGuide() {
  const { isAuthenticated, loading } = useAuth();
  const { openLoginModal } = useAuthModal();
  const [platform, setPlatform] = useState<'ios' | 'other' | null>(null);
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    setPlatform(isIOS() ? 'ios' : 'other');
    setInstalled(isStandalone());
    const sync = () => setCanPrompt(!!window.__buddypayInstallPrompt);
    sync();
    window.addEventListener('buddypay:installable', sync);
    return () => window.removeEventListener('buddypay:installable', sync);
  }, []);

  const install = async () => {
    const prompt = window.__buddypayInstallPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (choice.outcome === 'accepted') setInstalled(true);
    window.__buddypayInstallPrompt = null;
    setCanPrompt(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
      <h1 className="text-2xl font-bold text-foreground">ใช้ BuddyPay บนมือถือ</h1>
      <p className="mt-1 text-muted-foreground">ติดตั้งลงหน้าจอโฮม เปิดได้ทันทีเหมือนแอป ไม่ต้องโหลดจากสโตร์ ฟรี</p>

      <div className="mt-6 space-y-4">
        <Section icon={<Smartphone className="h-5 w-5 text-primary" aria-hidden />} title="1. ติดตั้งลงหน้าจอโฮม">
          {installed ? (
            <p className="flex items-center gap-2 text-success-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden /> ติดตั้งแล้ว กำลังเปิดจากหน้าจอโฮม
            </p>
          ) : platform === 'ios' ? (
            <ol className="space-y-3">
              <Step n={1}>
                เปิดหน้านี้ใน <b>Safari</b>
              </Step>
              <Step n={2}>
                แตะปุ่มแชร์ <Share className="inline h-4 w-4 align-text-bottom" aria-label="แชร์" /> ด้านล่างจอ
              </Step>
              <Step n={3}>
                เลื่อนลงแล้วแตะ <b>เพิ่มไปยังหน้าจอโฮม</b> <Plus className="inline h-4 w-4 align-text-bottom" aria-hidden />
              </Step>
            </ol>
          ) : canPrompt ? (
            <Button onClick={install} size="lg" className="w-full sm:w-auto">
              <Download className="mr-2 h-5 w-5" aria-hidden /> ติดตั้งแอป
            </Button>
          ) : (
            <ol className="space-y-3">
              <Step n={1}>
                เปิดหน้านี้ใน <b>Chrome</b>
              </Step>
              <Step n={2}>
                แตะเมนู <b>⋮</b> มุมขวาบน
              </Step>
              <Step n={3}>
                แตะ <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b>
              </Step>
            </ol>
          )}
          {platform === 'other' && (
            <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Android: กดค้างที่ไอคอน BuddyPay จะมีทางลัด <b>หารด่วน</b>, <b>ใส่บิล</b> และ <b>ใครยังค้าง</b> ให้แตะได้เลย
            </p>
          )}
        </Section>

        <Section icon={<Bell className="h-5 w-5 text-primary" aria-hidden />} title="2. ตัวเลขยอดค้างบนไอคอน และแจ้งเตือนทวงเงิน">
          <p className="text-muted-foreground">
            ไอคอนแอปขึ้นตัวเลขจำนวนคนที่ยังไม่จ่าย และทุกเย็นแจ้งเตือนว่าใครยังไม่โอน แตะแล้วเปิดหน้าทวงเงินทันที
          </p>
          <div className="mt-4">
            {loading ? null : !isAuthenticated ? (
              <Button variant="outline" onClick={openLoginModal}>
                เข้าสู่ระบบเพื่อเปิดใช้
              </Button>
            ) : platform === 'ios' && !installed ? (
              <p className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
                iPhone ต้องติดตั้งลงหน้าจอโฮม (ข้อ 1) แล้วเปิดจากไอคอนก่อน จึงจะเปิดแจ้งเตือนได้ (iOS 16.4 ขึ้นไป)
              </p>
            ) : (
              <NotificationToggle />
            )}
          </div>
        </Section>

        <Section icon={<Zap className="h-5 w-5 text-primary" aria-hidden />} title="3. ไอคอนหารด่วนแยกอีกอัน">
          <p className="text-muted-foreground">
            อยากแตะทีเดียวแล้วเข้าหน้าหารด่วนเลย เพิ่มไอคอน <b>หารด่วน</b> ไว้ข้าง ๆ ได้อีกอัน
          </p>
          <ol className="mt-3 space-y-3">
            <Step n={1}>
              เปิด <Link href="/quick" className="font-semibold text-primary underline underline-offset-2">หน้าหารด่วน</Link>
            </Step>
            <Step n={2}>{platform === 'ios' ? 'แตะปุ่มแชร์ แล้วแตะ เพิ่มไปยังหน้าจอโฮม' : 'แตะเมนู ⋮ แล้วแตะ ติดตั้งแอป หรือ เพิ่มลงในหน้าจอหลัก'}</Step>
          </ol>
        </Section>
      </div>
    </div>
  );
}
