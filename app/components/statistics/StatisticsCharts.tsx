import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StatisticsData, CategoryStats } from '@/app/hooks/useStatistics';

const COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

interface StatisticsChartsProps {
  stats: StatisticsData;
  categoryStats: CategoryStats[];
}

export const StatisticsCharts = ({ stats, categoryStats }: StatisticsChartsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* กราฟแท่งแสดงค่าใช้จ่ายรายเดือน */}
      <Card>
        <CardHeader>
          <CardTitle>ค่าใช้จ่ายรายเดือน</CardTitle>
          <CardDescription>ยอดรวมค่าใช้จ่ายในแต่ละเดือนที่ผ่านมา</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.monthlyExpenses}
                margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`${value.toLocaleString()} บาท`, 'ยอดรวม']}
                  labelFormatter={(label: string) => {
                    const item = stats.monthlyExpenses.find(item => item.name === label);
                    return item ? `เดือน${item.month}` : label;
                  }}
                />
                <Legend />
                <Bar dataKey="value" name="ยอดรวม (บาท)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* กราฟวงกลมแสดงค่าใช้จ่ายตามหมวดหมู่ */}
      <Card>
        <CardHeader>
          <CardTitle>ค่าใช้จ่ายตามหมวดหมู่</CardTitle>
          <CardDescription>สัดส่วนค่าใช้จ่ายแบ่งตามหมวดหมู่</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  // แสดงแค่เปอร์เซ็นต์ ชื่อหมวดอยู่ใน legend ด้านล่าง (ชื่อยาวถูกตัดบนจอมือถือ)
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {categoryStats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `${Number(value).toLocaleString()} บาท`}
                  contentStyle={{ borderRadius: '8px', padding: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* เพิ่มตัวชี้แจงสีของแต่ละหมวดหมู่ */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categoryStats.slice(0, 6).map((entry, index) => (
              <div key={`legend-${index}`} className="flex items-center min-w-0">
                <div 
                  className="w-3 h-3 rounded-full mr-2 flex-shrink-0" 
                  style={{ backgroundColor: entry.color || COLORS[index % COLORS.length] }}
                ></div>
                <span className="text-xs sm:text-sm truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 