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
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-500 rounded-lg text-white mr-3 sm:mr-4 flex-shrink-0">
              <ShoppingBag size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-blue-700">จำนวนบิลทั้งหมด</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{stats.totalBills || 0} บิล</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100">
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-emerald-500 rounded-lg text-white mr-3 sm:mr-4 flex-shrink-0">
              <DollarSign size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-emerald-700">ยอดรวมทั้งหมด</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{renderSafeAmount(stats.totalAmount)} บาท</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-amber-500 rounded-lg text-white mr-3 sm:mr-4 flex-shrink-0">
              <TrendingUp size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-amber-700">ค่าใช้จ่ายเฉลี่ย</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{renderSafeAmount(stats.averageAmount)} บาท</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-500 rounded-lg text-white mr-3 sm:mr-4 flex-shrink-0">
              <Calendar size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-purple-700">หมวดหมู่ยอดนิยม</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{stats.mostFrequentCategory || 'ไม่มีข้อมูล'}</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-red-100">
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-500 rounded-lg text-white mr-3 sm:mr-4 flex-shrink-0">
              <Users size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-red-700">ผู้ค้างชำระ</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{stats.pendingParticipants?.length || 0} คน</h3>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-500 rounded-lg text-white mr-3 sm:mr-4 flex-shrink-0">
              <AlertTriangle size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-orange-700">เงินค้างชำระ</p>
              <h3 className="text-lg sm:text-2xl font-bold tabular-nums break-words leading-tight">{renderSafeAmount(stats.totalPendingAmount || 0)} บาท</h3>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 