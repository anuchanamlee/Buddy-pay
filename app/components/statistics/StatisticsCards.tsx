import { Card, CardContent } from '@/app/components/ui/Card';
import { DollarSign, TrendingUp, ShoppingBag, Calendar, AlertTriangle, Users } from 'lucide-react';
import { StatisticsData } from '@/app/hooks/useStatistics';

interface StatisticsCardsProps {
  stats: StatisticsData;
  renderSafeAmount: (amount: number) => string;
}

export const StatisticsCards = ({ stats, renderSafeAmount }: StatisticsCardsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-8">
      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-jade-50 rounded-lg text-jade-700 mr-3 sm:mr-4 flex-shrink-0">
              <ShoppingBag size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">จำนวนบิลทั้งหมด</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{stats.totalBills || 0} บิล</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-jade-50 rounded-lg text-jade-700 mr-3 sm:mr-4 flex-shrink-0">
              <DollarSign size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">ยอดรวมทั้งหมด</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{renderSafeAmount(stats.totalAmount)} บาท</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-jade-50 rounded-lg text-jade-700 mr-3 sm:mr-4 flex-shrink-0">
              <TrendingUp size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">ค่าใช้จ่ายเฉลี่ย</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{renderSafeAmount(stats.averageAmount)} บาท</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-jade-50 rounded-lg text-jade-700 mr-3 sm:mr-4 flex-shrink-0">
              <Calendar size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">หมวดหมู่ยอดนิยม</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{stats.mostFrequentCategory || 'ไม่มีข้อมูล'}</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-warning-50 rounded-lg text-warning-700 mr-3 sm:mr-4 flex-shrink-0">
              <Users size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">ผู้ค้างชำระ</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{stats.pendingParticipants?.length || 0} คน</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-warning-50 rounded-lg text-warning-700 mr-3 sm:mr-4 flex-shrink-0">
              <AlertTriangle size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">เงินค้างชำระ</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{renderSafeAmount(stats.totalPendingAmount || 0)} บาท</h3>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 