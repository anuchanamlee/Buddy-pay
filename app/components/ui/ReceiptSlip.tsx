import { CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTHB } from '@/app/lib/format';

interface ReceiptSlipProps {
  name: string;
  amount: number;
  /** บรรทัดเล็กใต้ชื่อ เช่น "3 รายการ" */
  detail?: string;
  status?: 'paid' | 'pending';
  className?: string;
  children?: React.ReactNode;
}

/**
 * ยอดที่แต่ละคนต้องจ่าย แสดงเป็นสลิปใบเสร็จ (จุดเด่นของแบรนด์)
 * ตัวเลขใหญ่และกว้างเท่ากัน สถานะมีไอคอนกับข้อความเสมอ ไม่พึ่งสีอย่างเดียว
 */
export function ReceiptSlip({ name, amount, detail, status, className, children }: ReceiptSlipProps) {
  return (
    <div className={cn('receipt-slip rounded-t-xl border border-b-0 border-border bg-card px-4 pt-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{name}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
        {status && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              status === 'paid' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700',
            )}
          >
            {status === 'paid' ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Clock className="h-3.5 w-3.5" aria-hidden />}
            {status === 'paid' ? 'จ่ายแล้ว' : 'รอจ่าย'}
          </span>
        )}
      </div>
      <div className="mt-3 border-t border-dashed border-border pt-3">
        <p className="text-[1.75rem] font-bold leading-none tabular-nums text-foreground">
          {formatTHB(amount)}
          <span className="ml-1 text-base font-medium text-muted-foreground">บาท</span>
        </p>
      </div>
      {children}
    </div>
  );
}
