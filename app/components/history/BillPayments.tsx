'use client';

import { CheckCircle2, Clock } from 'lucide-react';
import { formatTHB } from '@/app/lib/format';
import { cn } from '@/lib/utils';
import { countPending, getAmountOwed, type PaymentBillLike, type PaymentStatus } from './paymentLogic';

export function BillStatusBadge({ bill }: { bill: PaymentBillLike }) {
  const pending = countPending(bill);
  const hasPeople = (bill.participants?.length ?? 0) > 0;
  const paid = hasPeople && pending === 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        paid ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
      )}
    >
      {paid ? <CheckCircle2 size={14} aria-hidden /> : <Clock size={14} aria-hidden />}
      {paid ? 'จ่ายครบแล้ว' : hasPeople ? `รอจ่าย ${pending} คน` : 'รอจ่าย'}
    </span>
  );
}

interface BillPaymentsProps {
  bill: PaymentBillLike & { id: string };
  /** ถ้าเป็น false จะแสดงสถานะอย่างเดียว กดไม่ได้ */
  canToggle: boolean;
  /** true ขณะบิลนี้กำลังบันทึก */
  saving: boolean;
  onToggle: (participantId: string, newStatus: PaymentStatus) => void;
}

export function BillPayments({ bill, canToggle, saving, onToggle }: BillPaymentsProps) {
  const participants = bill.participants || [];
  if (participants.length === 0) return null;

  return (
    <ul className="space-y-1.5" aria-label="สถานะการจ่ายของแต่ละคน">
      {participants.map((p) => {
        const paid = p.status === 'paid';
        const amount = getAmountOwed(bill, p.id);
        const name = p.name || 'ไม่มีชื่อ';
        const tone = paid ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700';
        const content = (
          <>
            {paid ? <CheckCircle2 size={18} aria-hidden className="shrink-0" /> : <Clock size={18} aria-hidden className="shrink-0" />}
            <span className="min-w-0 flex-1 truncate text-left font-medium">{name}</span>
            {amount !== null && <span className="tabular-nums">{formatTHB(amount)} บาท</span>}
            <span className="shrink-0 text-xs font-semibold">{paid ? 'จ่ายแล้ว' : 'รอจ่าย'}</span>
          </>
        );
        const base = 'flex w-full items-center gap-2 rounded-[10px] px-3 text-sm';
        return (
          <li key={p.id}>
            {canToggle ? (
              <button
                type="button"
                aria-pressed={paid}
                aria-label={paid ? `${name} จ่ายแล้ว กดเพื่อยกเลิก` : `ทำเครื่องหมายว่า ${name} จ่ายแล้ว`}
                disabled={saving}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(p.id, paid ? 'pending' : 'paid');
                }}
                onKeyDown={(e) => e.stopPropagation()}
                className={cn(
                  base,
                  tone,
                  'min-h-11 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60'
                )}
              >
                {content}
              </button>
            ) : (
              <div className={cn(base, tone, 'min-h-9 py-1.5')}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
