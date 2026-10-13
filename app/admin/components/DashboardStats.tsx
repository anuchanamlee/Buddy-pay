'use client';

import { useState, useEffect } from 'react';
import { CreditCard, User, Clock, TrendingUp, Calendar } from 'lucide-react';
import { collection, query, getDocs, where, Timestamp, orderBy, limit, getCountFromServer, getAggregateFromServer, sum, count } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { th } from 'date-fns/locale';



// กำหนดประเภทข้อมูลสำหรับ monthlyStats
interface MonthlyStats {
  month: string;
  amount: number;
}

export default function DashboardStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalBills: number;
    totalAmount: number;
    recentPayments: any[];
    monthlyStats: MonthlyStats[];
    pendingBills: number;
  }>({
    totalUsers: 0,
    totalBills: 0,
    totalAmount: 0,
    recentPayments: [],
    monthlyStats: [],
    pendingBills: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // ใช้ aggregation query (นับ/รวมยอดที่ server) คิด 1 read ต่อ 1,000 เอกสาร
        // เดิมดึงบิลและผู้ใช้ทุกเอกสารมานับในเครื่อง ค่าอ่านโตตามจำนวนข้อมูลทั้งระบบ
        const billsRef = collection(db, 'bills');
        const [billsAgg, usersCount, pendingCount] = await Promise.all([
          getAggregateFromServer(billsRef, { count: count(), total: sum('totalAmount') }),
          getCountFromServer(query(collection(db, 'users'), where('status', '==', 'active'))),
          getCountFromServer(query(billsRef, where('status', '==', 'pending'))),
        ]);
        const totalBills = Number(billsAgg.data().count) || 0;
        const totalAmount = Number(billsAgg.data().total) || 0;
        const totalUsers = usersCount.data().count;
        const pendingBills = pendingCount.data().count;

        // ดึงการชำระเงินล่าสุด
        const recentPaymentsQuery = query(
          collection(db, 'bills'),
          where('status', '==', 'paid'),
          orderBy('paymentDate', 'desc'),
          limit(5)
        );
        const recentPaymentsSnapshot = await getDocs(recentPaymentsQuery);
        const recentPayments = recentPaymentsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.name || data.title || 'ไม่มีชื่อ',
            amount: data.totalAmount ?? data.amount ?? 0,
            date: formatDate(data.paymentDate),
            owner: data.ownerName || 'ไม่ระบุ'
          };
        });
        
        // คำนวณสถิติรายเดือน (ย้อนหลัง 6 เดือน)
        const getMonthlyStats = async () => {
          const monthlyStats: MonthlyStats[] = [];
          const now = new Date();
          
          // ดึงข้อมูล 6 เดือนย้อนหลัง
          for (let i = 0; i < 6; i++) {
            const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            
            // ดึงบิลในช่วงเดือนนี้
            const monthBillsQuery = query(
              collection(db, 'bills'),
              where('createdAt', '>=', Timestamp.fromDate(monthStart)),
              where('createdAt', '<=', Timestamp.fromDate(monthEnd))
            );
            
            const monthAgg = await getAggregateFromServer(monthBillsQuery, { total: sum('totalAmount') });
            const monthAmount = Number(monthAgg.data().total) || 0;

            monthlyStats.push({
              month: format(month, 'MMM yyyy', { locale: th }),
              amount: monthAmount
            });
          }
          
          // กลับลำดับเพื่อให้เดือนเก่าอยู่ด้านซ้าย
          monthlyStats.reverse();
          
          return monthlyStats;
        };
        
        const monthlyStatsData = await getMonthlyStats();
        
        setStats({
          totalUsers,
          totalBills,
          totalAmount,
          recentPayments,
          monthlyStats: monthlyStatsData,
          pendingBills
        });
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError('ไม่สามารถโหลดข้อมูลสถิติได้');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  // ฟังก์ชั่นแปลงวันที่
  const formatDate = (dateInput: any) => {
    if (!dateInput) return 'ไม่ระบุวันที่';
    
    try {
      const date = dateInput instanceof Date 
        ? dateInput 
        : dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
      
      return format(date, 'd MMM yyyy', { locale: th });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'ไม่ระบุวันที่';
    }
  };

  if (loading) {
    return (
      <div className="w-full h-36 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 text-red-600 rounded-md">
        {error}
      </div>
    );
  }

  // หายอดสูงสุดสำหรับ chart เพื่อแสดงผลให้ดีขึ้น
  const maxMonthAmount = Math.max(...stats.monthlyStats.map(item => item.amount));

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* จำนวนบิลทั้งหมด */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">บิลทั้งหมด</p>
              <h3 className="text-2xl font-bold mt-2">{stats.totalBills.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>
        
        {/* จำนวนผู้ใช้ */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">ผู้ใช้งาน</p>
              <h3 className="text-2xl font-bold mt-2">{stats.totalUsers.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>
        
        {/* บิลที่รอชำระ */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">รอชำระ</p>
              <h3 className="text-2xl font-bold mt-2">{stats.pendingBills.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        
        {/* ยอดเงินทั้งหมด */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">ยอดเงินรวม</p>
              <h3 className="text-2xl font-bold mt-2">฿{stats.totalAmount.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* แนวโน้มรายเดือน */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-medium mb-4">แนวโน้มรายเดือน</h3>
          
          <div className="h-60">
            {/* กราฟแสดงแนวโน้มรายเดือน */}
            <div className="w-full h-full flex items-end justify-between">
              {stats.monthlyStats.map((item, index) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div 
                    className="w-full max-w-[40px] bg-primary/80 hover:bg-primary transition-all rounded-t"
                    style={{ 
                      height: `${item.amount > 0 ? (item.amount / maxMonthAmount) * 100 : 0}%`,
                      minHeight: item.amount > 0 ? '4px' : '0'
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center">{item.month}</p>
                  <p className="text-xs font-medium mt-1 text-center">
                    {item.amount > 0 ? `฿${item.amount.toLocaleString()}` : '-'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* การชำระเงินล่าสุด */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-medium mb-4">การชำระเงินล่าสุด</h3>
          
          {stats.recentPayments.length > 0 ? (
            <div className="space-y-4">
              {stats.recentPayments.map(payment => (
                <div key={payment.id} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{payment.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{payment.date}</span>
                    </div>
                  </div>
                  <p className="font-medium">฿{payment.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              ไม่มีการชำระเงินล่าสุด
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 