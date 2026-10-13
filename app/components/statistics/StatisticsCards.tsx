import type { ReactNode } from 'react';
import { Card, CardContent } from '@/app/components/ui/Card';
import { Wallet, TrendingUp, ReceiptText, Tag, Users, Clock } from 'lucide-react';
import { formatTHB } from '@/app/lib/format';
import { cn } from '@/lib/utils';
import { StatisticsData } from '@/app/hooks/useStatistics';

interface StatisticsCardsProps {
  stats: StatisticsData;
  /** ไม่ใช้แล้ว (ใช้ formatTHB แทน) คงไว้เพื่อไม่ให้ผู้เรียกเดิมพัง */
  renderSafeAmount?: (amount: number) => string;
}

interface StatItem {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  pending?: boolean;
}

export const StatisticsCards = ({ stats }: StatisticsCardsProps) => {
  const items: StatItem[] = [
    { label: 'จำนวนบิลทั้งหมด', value: `${stats.totalBills || 0} บิล`, icon: <ReceiptText className="h-5 w-5" aria-hidden /> },
    { label: 'ยอดรวมทั้งหมด', value: `${formatTHB(stats.totalAmount)} บาท`, icon: <Wallet className="h-5 w-5" aria-hidden /> },
    { label: 'ค่าใช้จ่ายเฉลี่ยต่อบิล', value: `${formatTHB(stats.averageAmount)} บาท`, icon: <TrendingUp className="h-5 w-5" aria-hidden /> },
    { label: 'หมวดที่ใช้บ่อยสุด', value: stats.mostFrequentCategory || 'ไม่มีข้อมูล', icon: <Tag className="h-5 w-5" aria-hidden /> },
    { label: 'คนที่ยังไม่จ่าย', value: `${stats.pendingParticipants?.length || 0} คน`, icon: <Users className="h-5 w-5" aria-hidden />, pending: true },
    { label: 'ยอดที่รอจ่าย', value: `${formatTHB(stats.totalPendingAmount || 0)} บาท`, icon: <Clock className="h-5 w-5" aria-hidden />, pending: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  item.pending ? 'bg-warning-50 text-warning-700' : 'bg-jade-50 text-jade-700',
                )}
              >
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p
                  className={cn(
                    'break-words text-lg font-bold leading-tight tabular-nums sm:text-2xl',
                    item.pending && 'text-warning-700',
                  )}
                >
                  {item.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
