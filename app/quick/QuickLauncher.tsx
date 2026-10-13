'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { isIOS, isStandalone } from '@/app/lib/pwa';

export function QuickLauncher() {
  const router = useRouter();
  const [ios, setIos] = useState<boolean | null>(null);

  useEffect(() => {
    // เปิดจากไอคอนหารด่วนบนหน้าจอโฮม (iPhone บางรุ่นเปิดหน้านี้แทน start_url) ให้ไปหน้าหารด่วนเลย
    if (isStandalone()) {
      router.replace('/share-bill?mode=quick');
      return;
    }
    setIos(isIOS());
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 pb-12 pt-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Zap className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-foreground">ไอคอนหารด่วน</h1>
      <p className="mt-2 text-muted-foreground">
        เพิ่มหน้านี้ลงหน้าจอโฮม จะได้ไอคอน <b>หารด่วน</b> แตะแล้วใส่ยอดรวมกับจำนวนคนได้ทันที
      </p>
      {ios !== null && (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-foreground">
          {ios ? 'แตะปุ่มแชร์ด้านล่างจอ แล้วแตะ "เพิ่มไปยังหน้าจอโฮม"' : 'แตะเมนู ⋮ แล้วแตะ "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"'}
        </p>
      )}
      <Link
        href="/share-bill?mode=quick"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-6 font-semibold text-primary-foreground"
      >
        หารด่วนเลย
      </Link>
    </div>
  );
}
