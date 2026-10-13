import { CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { formatTHB, formatThaiDate } from '@/app/lib/format';
import { StatisticsData, PopularCategory } from '@/app/hooks/useStatistics';

interface StatisticsDetailsProps {
  stats: StatisticsData;
  popularCategories: PopularCategory[];
  /** ไม่ใช้แล้ว (ใช้ formatTHB แทน) คงไว้เพื่อไม่ให้ผู้เรียกเดิมพัง */
  renderSafeAmount?: (amount: number) => string;
  calculatePercentage: (a: number, b: number) => number;
}

export const StatisticsDetails = ({
  stats,
  popularCategories,
  calculatePercentage,
}: StatisticsDetailsProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">สถานะการชำระเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-success-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                <span className="text-xl font-bold tabular-nums sm:text-2xl">{stats.settledBills}</span>
              </div>
              <div className="text-sm text-muted-foreground">จ่ายแล้ว</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-warning-700">
                <Clock className="h-4 w-4" aria-hidden />
                <span className="text-xl font-bold tabular-nums sm:text-2xl">{stats.pendingBills}</span>
              </div>
              <div className="text-sm text-muted-foreground">รอจ่าย</div>
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums sm:text-2xl">
                {calculatePercentage(stats.settledBills, stats.totalBills)}%
              </div>
              <div className="text-sm text-muted-foreground">จ่ายครบแล้ว</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">บิลที่ยอดสูงสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="truncate font-semibold">{stats.mostExpensiveBill.title || 'ไม่มีข้อมูล'}</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {formatThaiDate(stats.mostExpensiveBill.date, { withTime: false })}
            </span>
            <span className="text-xl font-bold tabular-nums">
              {formatTHB(stats.mostExpensiveBill.amount)} บาท
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">หมวดที่ใช้บ่อย</CardTitle>
        </CardHeader>
        <CardContent>
          {popularCategories && popularCategories.length > 0 ? (
            <ul className="divide-y divide-border">
              {popularCategories.map((category) => (
                <li key={category.id} className="flex items-center gap-2 py-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{category.name}</span>
                  {category.count && (
                    <span className="ml-auto shrink-0 text-sm tabular-nums text-muted-foreground">
                      {category.count} บิล
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-muted-foreground">ยังไม่มีข้อมูลหมวด</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
