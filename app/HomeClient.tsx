'use client';

import Link from 'next/link';
import { QrCode, History, BellRing, Scale } from 'lucide-react';
import { buttonVariants } from '@/app/components/ui/Button';
import { ReceiptSlip } from '@/app/components/ui/ReceiptSlip';
import { useAuthModal } from './context/AuthModalContext';
import { allocateSatang, fromSatang, toSatang } from './lib/money';
import { formatTHB } from './lib/format';
import { cn } from '@/lib/utils';

// ตัวอย่างบิลจริงในหน้าแรก คำนวณด้วยสูตรเดียวกับแอป (หารเป็นสตางค์)
const demoBill = {
  name: 'หมูกระทะหลังเลิกงาน',
  items: [
    { name: 'บุฟเฟต์ 4 ที่', price: 1196 },
    { name: 'น้ำแข็งกับน้ำเปล่า', price: 54 },
  ],
  people: [
    { name: 'มิ้นท์', paid: true },
    { name: 'บอส', paid: false },
    { name: 'ฝน', paid: true },
    { name: 'เจ', paid: false },
  ],
};
const demoTotal = demoBill.items.reduce((sum, i) => sum + i.price, 0);
const demoShares = allocateSatang(toSatang(demoTotal), demoBill.people.map(() => 1)).map(fromSatang);

const steps = [
  { title: 'ใส่ชื่อเพื่อน', description: 'พิมพ์ชื่อคนที่ไปด้วยกัน หรือเลือกกลุ่มที่เคยบันทึกไว้' },
  { title: 'ใส่รายการ', description: 'จดเมนูกับราคา จะหารเท่ากันหรือหารตามที่แต่ละคนกินก็ได้' },
  { title: 'ส่งยอดให้เพื่อน', description: 'ได้ยอดของทุกคนพร้อม QR พร้อมเพย์ ส่งเข้า LINE ได้ในคลิกเดียว' },
];

const features = [
  { icon: Scale, title: 'หารตามที่กินจริง', description: 'ใครไม่ได้กินเมนูไหนก็ไม่ต้องจ่าย VAT ค่าบริการ และส่วนลดถูกแบ่งตามสัดส่วนให้เอง' },
  { icon: QrCode, title: 'QR ของแต่ละคน', description: 'เพื่อนสแกนแล้วยอดของตัวเองขึ้นทันที ไม่ต้องพิมพ์ตัวเลขเอง' },
  { icon: BellRing, title: 'รู้ว่าใครยังไม่จ่าย', description: 'ติ๊กคนที่จ่ายแล้ว ยอดค้างรวมแสดงที่เมนูด้านบนตลอด' },
  { icon: History, title: 'ย้อนดูบิลเก่าได้', description: 'บิลที่บันทึกไว้อยู่ในประวัติ พร้อมสถิติว่าแต่ละเดือนใช้ไปเท่าไร' },
];

export default function HomeClient() {
  const { openSignupModal } = useAuthModal();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero: ข้อความหลักกับตัวอย่างบิลจริง */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div>
            <h1 id="main-heading" className="text-[2.25rem] font-bold leading-[1.2] text-foreground md:text-5xl md:leading-[1.15]">
              หารบิลกับเพื่อน
              <br />
              จบในนาทีเดียว
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
              ใส่ชื่อเพื่อนกับรายการอาหาร BuddyPay คิดยอดของทุกคนให้ถึงสตางค์ พร้อม QR พร้อมเพย์ที่ใส่ยอดไว้แล้ว ไม่ต้องสมัครก็ใช้ได้
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/share-bill" className={cn(buttonVariants({ size: 'lg' }), 'px-7')}>
                เริ่มหารบิล
              </Link>
              <button type="button" onClick={openSignupModal} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                สมัครเพื่อบันทึกบิล
              </button>
            </div>
          </div>

          {/* ตัวอย่างผลลัพธ์ หน้าตาเดียวกับหน้าผลลัพธ์จริง */}
          <figure aria-label="ตัวอย่างผลการหารบิล" className="rounded-2xl bg-jade-50 p-4 sm:p-6">
            <figcaption className="mb-4 flex items-baseline justify-between gap-3">
              <span className="font-semibold text-jade-900">{demoBill.name}</span>
              <span className="tabular-nums text-sm text-jade-800">รวม {formatTHB(demoTotal)} บาท</span>
            </figcaption>
            <div className="grid grid-cols-2 gap-3">
              {demoBill.people.map((p, i) => (
                <ReceiptSlip key={p.name} name={p.name} amount={demoShares[i]} status={p.paid ? 'paid' : 'pending'} />
              ))}
            </div>
          </figure>
        </div>
      </section>

      {/* วิธีใช้: เป็นลำดับจริง จึงใช้ตัวเลข */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">ใช้ยังไง</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-border bg-card py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">ทำอะไรได้บ้าง</h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 max-w-[30rem] leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">มื้อหน้าลองหารด้วย BuddyPay</h2>
            <p className="mt-2 text-muted-foreground">สมัครฟรี เพื่อเก็บบิลไว้ติดตามว่าใครจ่ายแล้วบ้าง</p>
          </div>
          <Link href="/share-bill" className={buttonVariants({ size: 'lg' })}>
            เริ่มหารบิล
          </Link>
        </div>
      </section>

      <footer className="mt-auto border-t border-border bg-card py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold text-foreground">BuddyPay</span> แอปหารบิลกับเพื่อน
          </p>
          <nav aria-label="ลิงก์ท้ายหน้า" className="flex gap-5">
            <Link href="/share-bill" className="hover:text-foreground">หารบิล</Link>
            <Link href="/bill-history" className="hover:text-foreground">ประวัติบิล</Link>
            <Link href="/statistics" className="hover:text-foreground">สถิติ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
