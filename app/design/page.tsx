import type { Metadata } from 'next';
import { CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Badge } from '@/app/components/ui/Badge';
import { Input } from '@/app/components/ui/Input';
import { ReceiptSlip } from '@/app/components/ui/ReceiptSlip';
import { PerPersonPromptPayQR } from '@/app/components/PromptPayQR';

export const metadata: Metadata = {
  title: 'Design system - BuddyPay',
  description: 'สี ตัวอักษร และ component ที่ใช้ทั้งแอป BuddyPay',
};

const jade = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const semantic = [
  { name: 'primary', varName: '--primary', use: 'ปุ่มหลัก ลิงก์ จุดที่กดได้' },
  { name: 'foreground', varName: '--foreground', use: 'ตัวอักษรหลัก' },
  { name: 'muted-foreground', varName: '--muted-foreground', use: 'คำอธิบาย ข้อความรอง' },
  { name: 'background', varName: '--background', use: 'พื้นหลังหน้า' },
  { name: 'success', varName: '--success', use: 'จ่ายแล้ว (คู่กับไอคอนติ๊กเสมอ)' },
  { name: 'warning', varName: '--warning', use: 'รอจ่าย / ค้างชำระ (คู่กับไอคอนนาฬิกา)' },
  { name: 'destructive', varName: '--destructive', use: 'ลบ ข้อผิดพลาด' },
];

const typeScale = [
  { label: 'หัวข้อหน้า', className: 'text-4xl font-bold leading-tight', sample: 'หารบิลกับเพื่อน' },
  { label: 'หัวข้อส่วน', className: 'text-2xl font-bold', sample: 'ยอดที่แต่ละคนต้องจ่าย' },
  { label: 'หัวข้อการ์ด', className: 'text-lg font-semibold', sample: 'รายการอาหาร' },
  { label: 'เนื้อความ', className: 'text-base leading-relaxed', sample: 'ใส่ชื่อเพื่อนกับรายการอาหาร แล้ว BuddyPay จะคิดยอดให้ถึงสตางค์' },
  { label: 'คำอธิบาย', className: 'text-sm text-muted-foreground', sample: 'ลิงก์หมดอายุใน 24 ชั่วโมง' },
  { label: 'ยอดเงิน', className: 'text-[1.75rem] font-bold tabular-nums', sample: '1,250.50 บาท' },
];

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-1 max-w-[40rem] text-muted-foreground">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-24">
      <h1 className="text-4xl font-bold text-foreground">BuddyPay design system</h1>
      <p className="mt-3 max-w-[40rem] text-lg text-muted-foreground">
        สะอาด เป็นมิตร และให้ตัวเลขเป็นพระเอก ทุกหน้าใช้ token ชุดนี้จาก <code className="rounded bg-muted px-1.5 py-0.5 text-sm">app/globals.css</code>
      </p>

      <Section title="สีหลัก jade" description="เขียวอมฟ้าเข้ม ให้ความรู้สึกเรื่องเงินที่เชื่อถือได้แต่ไม่แข็ง ใช้ 600 เป็นสีหลัก ตัวอักษรขาวบน 600 ผ่าน WCAG AA">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-11">
          {jade.map((step) => (
            <div key={step}>
              <div className="h-14 rounded-lg border border-black/5" style={{ background: `var(--color-jade-${step})` }} />
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="สีตามหน้าที่" description="เรียกใช้ตามความหมาย ไม่ใช้ค่าสีตรง ๆ ในหน้า สีสถานะใช้คู่กับไอคอนและข้อความเสมอ คนที่แยกสีไม่ออกก็เข้าใจได้">
        <ul className="grid gap-3 sm:grid-cols-2">
          {semantic.map((c) => (
            <li key={c.name} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span className="h-10 w-10 shrink-0 rounded-lg border border-black/5" style={{ background: `var(${c.varName})` }} />
              <span>
                <span className="block font-medium text-foreground">{c.name}</span>
                <span className="block text-sm text-muted-foreground">{c.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="ตัวอักษร" description="IBM Plex Sans Thai ตัวเดียวทั้งแอป มีทั้งไทยและอังกฤษ ตัวเลขทุกจุดที่เป็นเงินใช้ tabular-nums ให้หลักตรงกัน">
        <dl className="divide-y divide-border rounded-xl border border-border bg-card">
          {typeScale.map((t) => (
            <div key={t.label} className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr] sm:items-baseline">
              <dt className="text-sm text-muted-foreground">{t.label}</dt>
              <dd className={`${t.className} text-foreground`}>{t.sample}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="สลิปยอดของแต่ละคน" description="จุดเด่นของแบรนด์ ใช้ที่หน้าผลลัพธ์และหน้าแรก ขอบล่างเป็นรอยปรุแบบใบเสร็จ">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <ReceiptSlip name="มิ้นท์" amount={312.75} detail="2 รายการ" status="paid" />
          <ReceiptSlip name="บอส" amount={312.75} detail="2 รายการ" status="pending" />
        </div>
      </Section>

      <Section title="ปุ่ม" description="ปุ่มหลักหนึ่งปุ่มต่อหนึ่งจุดตัดสินใจ สูง 44px ขึ้นไปให้กดบนมือถือง่าย ข้อความบอกสิ่งที่จะเกิดขึ้น">
        <div className="flex flex-wrap items-center gap-3">
          <Button>บันทึกบิล</Button>
          <Button variant="secondary">ส่งเข้า LINE</Button>
          <Button variant="outline">ย้อนกลับ</Button>
          <Button variant="ghost">ยกเลิก</Button>
          <Button variant="danger">ลบบิล</Button>
          <Button disabled>บันทึกบิล</Button>
        </div>
      </Section>

      <Section title="สถานะและป้าย" description="สถานะการจ่ายมีไอคอนกำกับ ป้ายอื่นใช้สีอ่อนพื้นหลังและตัวอักษรเข้ม">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-sm font-medium text-success-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> จ่ายแล้ว
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 text-sm font-medium text-warning-700">
            <Clock className="h-4 w-4" aria-hidden /> รอจ่าย
          </span>
          <Badge>ข้อมูลตัวอย่าง</Badge>
        </div>
      </Section>

      <Section title="ช่องกรอก" description="ป้ายชื่ออยู่เหนือช่องเสมอ ข้อผิดพลาดบอกว่าต้องแก้อะไร">
        <div className="grid max-w-md gap-4">
          <Input label="ชื่อบิล" placeholder="เช่น หมูกระทะหลังเลิกงาน" />
          <Input label="พร้อมเพย์" placeholder="เบอร์มือถือ 10 หลัก" error="เบอร์ต้องมี 10 หลัก" defaultValue="08123" />
        </div>
      </Section>

      <Section title="QR ของแต่ละคน" description="เลือกชื่อแล้วได้ QR พร้อมเพย์ที่ใส่ยอดของคนนั้น (ตัวอย่างนี้ใช้เลขสมมุติ)">
        <div className="max-w-sm rounded-xl border border-border bg-card p-4">
          <PerPersonPromptPayQR
            promptPayId="0800000000"
            people={[
              { id: 'a', name: 'มิ้นท์', amount: 312.75 },
              { id: 'b', name: 'บอส', amount: 312.75 },
              { id: 'c', name: 'ฝน', amount: 312.75, paid: true },
            ]}
          />
        </div>
      </Section>
    </main>
  );
}
