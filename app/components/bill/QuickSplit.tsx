'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { formatTHB } from '@/app/lib/format';
import { allocateSatang, fromSatang, toSatang } from '@/app/lib/money';
import { parsePrice } from './BillEditor';

const MAX_PEOPLE = 50;

/** หารด่วน: ใส่ยอดท้ายใบเสร็จกับจำนวนคน แล้วไปหน้าผลลัพธ์ได้ทันที */
export function QuickSplit({ onSubmit }: { onSubmit: (total: number, count: number) => void }) {
  const [totalText, setTotalText] = useState('');
  const [count, setCount] = useState(2);
  const total = parsePrice(totalText);
  const valid = total > 0 && count >= 2;
  const shares = valid ? allocateSatang(toSatang(total), new Array(count).fill(1)).map(fromSatang) : [];
  const min = shares.length ? Math.min(...shares) : 0;
  const max = shares.length ? Math.max(...shares) : 0;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(total, count);
      }}
    >
      <label className="block">
        <span className="text-lg font-semibold text-foreground">ยอดรวมท้ายใบเสร็จ</span>
        <span className="relative mt-2 block">
          <input
            value={totalText}
            onChange={(e) => setTotalText(e.target.value)}
            inputMode="decimal"
            enterKeyHint="go"
            placeholder="0"
            autoComplete="off"
            autoFocus
            className="h-16 w-full rounded-xl border border-input bg-card pl-4 pr-16 text-right text-3xl font-bold tabular-nums text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">บาท</span>
        </span>
      </label>

      <div>
        <span id="count-label" className="text-lg font-semibold text-foreground">หารกี่คน</span>
        <div className="mt-2 flex items-center gap-3" role="group" aria-labelledby="count-label">
          <Button type="button" variant="outline" size="icon" onClick={() => setCount((c) => Math.max(2, c - 1))} disabled={count <= 2} aria-label="ลดจำนวนคน">
            <Minus className="h-5 w-5" aria-hidden />
          </Button>
          <output className="min-w-[4rem] text-center text-3xl font-bold tabular-nums text-foreground" aria-live="polite">
            {count}
          </output>
          <Button type="button" variant="outline" size="icon" onClick={() => setCount((c) => Math.min(MAX_PEOPLE, c + 1))} disabled={count >= MAX_PEOPLE} aria-label="เพิ่มจำนวนคน">
            <Plus className="h-5 w-5" aria-hidden />
          </Button>
          <span className="text-muted-foreground">คน</span>
        </div>
      </div>

      <div className="rounded-xl bg-jade-50 p-4" aria-live="polite">
        <p className="text-sm text-jade-800">คนละ</p>
        <p className="text-3xl font-bold tabular-nums text-jade-900">
          {valid ? (min === max ? formatTHB(max) : `${formatTHB(min)}–${formatTHB(max)}`) : '0'} บาท
        </p>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={!valid}>
        ทำ QR ให้เพื่อนสแกนจ่าย
      </Button>
    </form>
  );
}
