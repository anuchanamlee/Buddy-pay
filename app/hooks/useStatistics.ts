import { useState, useEffect, useMemo, useCallback } from 'react';
import { billShares } from '@/app/lib/billShares';
import { collection, query, where, getDocs, orderBy, limit, type QuerySnapshot, type DocumentData } from 'firebase/firestore';

// สถิติคิดจากบิลล่าสุดไม่เกินจำนวนนี้ (เดิมดึงทุกใบทุกครั้งที่เปิดหน้า ค่าอ่าน Firestore โตตามจำนวนบิลไม่มีเพดาน)
export const STATS_MAX_BILLS = 300;
// เปิดหน้าสถิติซ้ำภายในเวลานี้ใช้ข้อมูลเดิม ไม่อ่าน Firestore ใหม่ (กดรีเฟรชข้อมูลได้เสมอ)
const STATS_REUSE_MS = 2 * 60 * 1000;
let lastStatsFetch: { uid: string; at: number; snapshot: QuerySnapshot<DocumentData> } | null = null;

/** เรียกหลังบันทึก/แก้/ลบบิล ให้หน้าสถิติอ่านข้อมูลใหม่ครั้งถัดไป */
export function invalidateStatsCache(): void {
  lastStatsFetch = null;
}
import { db } from '@/app/lib/firebase';
import { Category, getCategoryById, getPopularCategories } from '@/app/lib/categories';
import { mockBills } from '@/app/lib/mockData';

// Types
export interface MonthlyData {
  name: string;
  value: number;
  month: string;
}

export interface CategoryData {
  name: string;
  value: number;
}

export interface PendingParticipant {
  name: string;
  totalPendingAmount: number;
  pendingBills: number;
  bills: Array<{
    id: string;
    title: string;
    amount: number;
    date: Date;
  }>;
}

export interface StatisticsData {
  totalBills: number;
  totalAmount: number;
  averageAmount: number;
  settledBills: number;
  pendingBills: number;
  pendingParticipants: PendingParticipant[];
  totalPendingAmount: number;
  mostExpensiveBill: {
    title: string;
    amount: number;
    date: Date;
  };
  mostFrequentCategory: string;
  monthlyExpenses: MonthlyData[];
  categoryExpenses: CategoryData[];
}

export interface Bill {
  id: string;
  title: string;
  date: Date;
  totalAmount: number;
  category: string;
  status: 'settled' | 'partial' | 'pending' | 'paid';
  createdAt: Date;
  participants: Array<{ id: string; name: string; status: string }>;
  splitResults?: Array<any>;
}

export interface CategoryStats {
  id: string;
  name: string;
  value: number;
  color: string;
}

export interface PopularCategory {
  id: string;
  name: string;
  color: string;
  count: number;
}

// Constants
const TAILWIND_COLORS: Record<string, string> = {
  'orange-500': '#f97316',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'pink-500': '#ec4899',
  'blue-500': '#3b82f6',
  'slate-600': '#475569',
  'zinc-700': '#3f3f46',
  'purple-600': '#9333ea',
  'green-600': '#16a34a',
  'red-500': '#ef4444',
  'emerald-600': '#059669',
  'rose-500': '#f43f5e',
  'indigo-500': '#6366f1',
  'yellow-500': '#eab308',
  'violet-500': '#8b5cf6',
  'cyan-600': '#0891b2',
  'gray-500': '#6b7280',
};

// Utility functions
const getTailwindColor = (tailwindColor: string): string => {
  const colorWithoutPrefix = tailwindColor.replace('text-', '');
  return TAILWIND_COLORS[colorWithoutPrefix] || '#999999';
};

const createLast6MonthsData = () => {
  const today = new Date();
  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const monthAbbr = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  
  const monthData = [];
  const monthLookup: Record<string, number> = {};
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const monthIndex = d.getMonth();
    const year = d.getFullYear();
    const yearMonth = `${year}-${monthIndex + 1}`;
    
    const index = 5 - i;
    monthData.push({
      name: monthAbbr[monthIndex],
      month: monthNames[monthIndex],
      value: 0,
      yearMonth
    });
    
    monthLookup[yearMonth] = index;
  }
  
  return { monthData, monthLookup };
};

/**
 * หาผู้ค้างชำระตาม Flow ที่กำหนด:
 * 1. รับข้อมูลบิล (Bill) เข้ามา
 * 2. กรองบิลที่สถานะของผู้ร่วมจ่ายเป็น "pending"
 * 3. คัดเลือกเฉพาะ participant ที่ยังไม่ได้ชำระเงิน (status === "pending")
 * 4. หาเงินค้างชำระของผู้ร่วมจ่าย pending แต่ละคน
 * 5. หา splitResult ที่ตรงกับ participant ตาม id
 * 6. ดึงยอดเงิน (amount) ของคน ๆ นั้น
 * 7. รวมข้อมูลเป็นรายการผู้ค้างชำระ
 */
export const calculatePendingParticipants = (bills: Bill[]): PendingParticipant[] => {
  const participantMap = new Map<string, PendingParticipant>();

  // วนลูปผ่านทุกบิล
  bills.forEach(bill => {
    // ตรวจสอบว่าบิลมี splitResults หรือไม่
    if (!bill.splitResults || !Array.isArray(bill.splitResults)) {
      return;
    }

    // วนลูปผ่าน splitResults ของบิลนี้
    bill.splitResults.forEach((splitResult: any) => {
      // ตรวจสอบว่ามี participant และ status เป็น pending
      if (!splitResult.participant || splitResult.participant.status !== 'pending') {
        return;
      }

      const participant = splitResult.participant;
      const participantId = participant.id;
      const participantName = participant.name;
      const pendingAmount = Number(splitResult.amount) || 0;

      // ตรวจสอบว่ามีคนนี้ใน Map หรือยัง
      if (participantMap.has(participantId)) {
        // ถ้ามีคนนี้อยู่แล้ว ให้บวกยอดเงินและเพิ่มบิล
        const existing = participantMap.get(participantId)!;
        existing.totalPendingAmount += pendingAmount;
        
        // ตรวจสอบว่าบิลนี้เคยถูกเพิ่มหรือยัง
        const billExists = existing.bills.some(b => b.id === bill.id);
        if (!billExists) {
          existing.pendingBills += 1;
          existing.bills.push({
            id: bill.id,
            title: bill.title || 'ไม่มีชื่อบิล',
            amount: pendingAmount,
            date: bill.date || bill.createdAt || new Date(),
          });
        } else {
          // ถ้าบิลนี้ถูกเพิ่มแล้ว ให้บวก amount เข้า bill นั้นแทน
          const billObj = existing.bills.find(b => b.id === bill.id);
          if (billObj) {
            billObj.amount += pendingAmount;
          }
        }
      } else {
        // ถ้าเป็นคนใหม่ ให้เพิ่มเข้าไปใน Map
        participantMap.set(participantId, {
          name: participantName,
          totalPendingAmount: pendingAmount,
          pendingBills: 1,
          bills: [{
            id: bill.id,
            title: bill.title || 'ไม่มีชื่อบิล',
            amount: pendingAmount,
            date: bill.date || bill.createdAt || new Date(),
          }]
        });
      }
    });
  });

  // แปลง Map เป็น Array และเรียงลำดับตามยอดเงินจากมากไปน้อย
  return Array.from(participantMap.values())
    .sort((a, b) => b.totalPendingAmount - a.totalPendingAmount);
};

/**
 * อัปเดตสถานะบิลตามสถานะของ participant
 * ถ้าทุก participant.status เป็น "paid" → bill.status = "paid"
 * ถ้ายังมี "pending" → bill.status = "pending"
 */
export const updateBillStatus = (bill: Bill): Bill => {
  const allPaid = bill.participants.every(p => p.status === "paid");
  if (allPaid) {
    bill.status = "paid"; // บิลจ่ายครบทุกคนแล้ว
  } else {
    bill.status = "pending"; // ยังมีคนค้างจ่าย
  }
  return bill;
};

const calculateStatistics = (bills: Bill[], monthLookup: Record<string, number>) => {
  const { monthData } = createLast6MonthsData();
  
  // อัปเดตสถานะบิลทุกบิลก่อนคำนวณ
  const updatedBills = bills.map(bill => updateBillStatus({ ...bill }));

  let totalAmount = 0;
  let maxBillAmount = 0;
  let maxBillIndex = -1;
  const categoryCounts: Record<string, number> = {};
  const categoryTotals: Record<string, number> = {};
  const billStatuses: Record<string, number> = {};
  
  // คำนวณทุกอย่างในลูปเดียว
  updatedBills.forEach((bill, index) => {
    const amount = bill.totalAmount;
    totalAmount += amount;
    if (amount > maxBillAmount) {
      maxBillAmount = amount;
      maxBillIndex = index;
    }
    billStatuses[bill.status] = (billStatuses[bill.status] || 0) + 1;
    const category = bill.category || 'other';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    // ข้อมูลรายเดือน
    const date = bill.date;
    const yearMonth = `${date.getFullYear()}-${date.getMonth() + 1}`;
    if (yearMonth in monthLookup) {
      monthData[monthLookup[yearMonth]].value += amount;
    }
  });
  
  return {
    totalAmount,
    maxBillIndex,
    categoryCounts,
    categoryTotals,
    billStatuses,
    monthData,
    updatedBills // ส่งออกไปใช้ต่อ
  };
};

export const useStatistics = (user: any, loading: boolean) => {
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [popularCategories, setPopularCategories] = useState<PopularCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Cache สำหรับ categories
  const categoryCache = useMemo(() => new Map<string, Category | { id: string; name: string; color: string; }>(), []);
  
  const getCachedCategory = useCallback((id: string) => {
    if (!categoryCache.has(id)) {
      categoryCache.set(id, getCategoryById(id) || { id: 'other', name: 'อื่นๆ', color: 'text-gray-500' });
    }
    return categoryCache.get(id)!;
  }, [categoryCache]);

  const createMockStatistics = useCallback(() => {
    setIsLoading(true);
    setError(null);

    try {
      const bills = mockBills;
      const { monthLookup } = createLast6MonthsData();

      // แปลง mockBills ให้ตรงกับ interface Bill
      const convertedBills: Bill[] = bills.map(bill => ({
        id: bill.id,
        title: bill.title,
        date: bill.date,
        totalAmount: bill.totalAmount,
        category: bill.category,
        status: bill.status,
        createdAt: bill.createdAt,
        participants: bill.participants || [],
        splitResults: bill.splitResults || [],
      }));

      const {
        totalAmount,
        maxBillIndex,
        categoryCounts,
        categoryTotals,
        billStatuses,
        monthData,
        updatedBills
      } = calculateStatistics(convertedBills, monthLookup);
      
      // หาหมวดหมู่ที่ใช้บ่อยที่สุด
      let mostFrequentCategory = 'other';
      let maxCount = 0;
      
      for (const [category, count] of Object.entries(categoryCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentCategory = category;
        }
      }
      
      const categoryObj = getCachedCategory(mostFrequentCategory);
      const mostFrequentCategoryName = categoryObj.name;
      
      // สร้างข้อมูลค่าใช้จ่ายตามหมวดหมู่
      const categoryExpenses = Object.entries(categoryTotals)
        .map(([id, value]) => {
          const category = getCachedCategory(id);
          return { 
            name: category.name, 
            value 
          };
        })
        .sort((a, b) => b.value - a.value);
      
      // หาบิลที่มีมูลค่าสูงสุด
      const defaultBill: Bill = {
        id: 'default',
        title: 'ไม่มีชื่อบิล',
        date: new Date(),
        createdAt: new Date(),
        totalAmount: 0,
        category: 'other',
        status: 'pending',
        participants: [],
        splitResults: [],
      };
      const mostExpensiveBill = maxBillIndex >= 0 ? updatedBills[maxBillIndex] : defaultBill;
      
      // คำนวณข้อมูลผู้ที่ค้างชำระ
      const pendingParticipants = calculatePendingParticipants(updatedBills);
      const totalPendingAmount = pendingParticipants.reduce((sum, p) => sum + p.totalPendingAmount, 0);
      
      // สร้างข้อมูลสถิติ
      const calculatedStats: StatisticsData = {
        totalBills: updatedBills.length,
        totalAmount,
        averageAmount: updatedBills.length > 0 ? Math.round(totalAmount / updatedBills.length) : 0,
        settledBills: (billStatuses['settled'] || 0) + (billStatuses['paid'] || 0),
        pendingBills: (billStatuses['pending'] || 0) + (billStatuses['partial'] || 0),
        pendingParticipants,
        totalPendingAmount,
        mostExpensiveBill: {
          title: mostExpensiveBill.title || 'ไม่มีชื่อบิล',
          amount: mostExpensiveBill.totalAmount || 0,
          date: new Date(mostExpensiveBill.date || Date.now())
        },
        mostFrequentCategory: mostFrequentCategoryName,
        monthlyExpenses: monthData,
        categoryExpenses: categoryExpenses.slice(0, 6),
      };
      
      setStats(calculatedStats);
      
      // สร้างข้อมูลสำหรับกราฟหมวดหมู่
      const categoryStatsData = Object.entries(categoryTotals)
        .map(([id, amount]) => {
          const category = getCachedCategory(id);
          return {
            id,
            name: category.name,
            value: amount,
            color: getTailwindColor(category.color)
          };
        })
        .sort((a, b) => b.value - a.value);
      
      setCategoryStats(categoryStatsData);
      
      // สร้างข้อมูลหมวดหมู่ยอดนิยม
      const popularCats = getPopularCategories(categoryCounts);
      const popularCatsWithCount = popularCats.map(category => ({
        ...category,
        count: categoryCounts[category.id] || 0
      }));
      
      setPopularCategories(popularCatsWithCount);
    } catch (error) {
      console.error('Error creating mock statistics:', error);
      setError('ไม่สามารถสร้างข้อมูลตัวอย่างได้');
    } finally {
      setIsLoading(false);
    }
  }, [getCachedCategory]);

  const fetchStatistics = useCallback(async (force: boolean | unknown = false) => {
    if (!user?.uid) {
      setError('ไม่พบข้อมูลผู้ใช้');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const billsRef = collection(db, 'bills');
      const q = query(
        billsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(STATS_MAX_BILLS)
      );

      const previous = lastStatsFetch;
      const reusable =
        force !== true && previous !== null && previous.uid === user.uid && Date.now() - previous.at < STATS_REUSE_MS;
      const querySnapshot = reusable ? previous.snapshot : await getDocs(q);
      if (!reusable) lastStatsFetch = { uid: user.uid, at: Date.now(), snapshot: querySnapshot };
      
      if (querySnapshot.empty) {
        setStats({
          totalBills: 0,
          totalAmount: 0,
          averageAmount: 0,
          settledBills: 0,
          pendingBills: 0,
          pendingParticipants: [],
          totalPendingAmount: 0,
          mostExpensiveBill: {
            title: 'ไม่มีข้อมูล',
            amount: 0,
            date: new Date()
          },
          mostFrequentCategory: 'ไม่มีข้อมูล',
          monthlyExpenses: [],
          categoryExpenses: []
        });
        setIsLoading(false);
        return;
      }
      
      // แปลงข้อมูลจาก Firestore เป็นอาร์เรย์
      const bills: Bill[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const billDate = data.createdAt?.toDate() || new Date();
        return {
          id: doc.id,
          title: data.name || 'ไม่มีชื่อบิล',
          date: billDate,
          totalAmount: data.totalAmount || 0,
          category: data.categoryId || data.category || (data.foodItems?.length ? 'food' : 'other'),
          status: data.status === 'paid' ? 'paid' : (data.status || 'pending'),
          createdAt: billDate,
          participants: Array.isArray(data.participants)
            ? data.participants.map((p: any) =>
                typeof p === 'object'
                  ? p
                  : { id: p, name: p, status: 'pending' }
              )
            : [],
          // คำนวณยอดของแต่ละคนใหม่จากรายการ (บิลเก่าเก็บยอดที่คิดด้วยสูตรเดิม)
          splitResults: billShares(data),
        };
      });
      
      const { monthLookup } = createLast6MonthsData();
      const {
        totalAmount,
        maxBillIndex,
        categoryCounts,
        categoryTotals,
        billStatuses,
        monthData,
        updatedBills
      } = calculateStatistics(bills, monthLookup);
      
      // หาหมวดหมู่ที่ใช้บ่อยที่สุด
      let mostFrequentCategory = 'other';
      let maxCount = 0;
      
      for (const [category, count] of Object.entries(categoryCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentCategory = category;
        }
      }
      
      const categoryObj = getCachedCategory(mostFrequentCategory);
      const mostFrequentCategoryName = categoryObj.name;
      
      // สร้างข้อมูลค่าใช้จ่ายตามหมวดหมู่
      const categoryExpenses = Object.entries(categoryTotals)
        .map(([id, value]) => {
          const category = getCachedCategory(id);
          return { 
            name: category.name, 
            value 
          };
        })
        .sort((a, b) => b.value - a.value);
      
      const mostExpensiveBill = updatedBills[maxBillIndex] || updatedBills[0];
      
      // คำนวณข้อมูลผู้ที่ค้างชำระ
      const pendingParticipants = calculatePendingParticipants(updatedBills);
      const totalPendingAmount = pendingParticipants.reduce((sum, p) => sum + p.totalPendingAmount, 0);
      
      const calculatedStats: StatisticsData = {
        totalBills: bills.length,
        totalAmount,
        averageAmount: bills.length > 0 ? Math.round(totalAmount / bills.length) : 0,
        settledBills: (billStatuses['settled'] || 0) + (billStatuses['paid'] || 0),
        pendingBills: (billStatuses['pending'] || 0) + (billStatuses['partial'] || 0),
        pendingParticipants,
        totalPendingAmount,
        mostExpensiveBill: {
          title: mostExpensiveBill.title,
          amount: mostExpensiveBill.totalAmount,
          date: mostExpensiveBill.date
        },
        mostFrequentCategory: mostFrequentCategoryName,
        monthlyExpenses: monthData,
        categoryExpenses: categoryExpenses.slice(0, 6),
      };
      
      setStats(calculatedStats);
      
      // เตรียมข้อมูลสำหรับกราฟหมวดหมู่
      const categoryStatsData = Object.entries(categoryTotals)
        .map(([id, amount]) => {
          const category = getCachedCategory(id);
          return {
            id,
            name: category.name,
            value: amount,
            color: getTailwindColor(category.color)
          };
        })
        .sort((a, b) => b.value - a.value);
      
      setCategoryStats(categoryStatsData);
      
      // สร้างข้อมูลหมวดหมู่ยอดนิยม
      const popularCats = getPopularCategories(categoryCounts);
      const popularCatsWithCount = popularCats.map(category => ({
        ...category,
        count: categoryCounts[category.id] || 0
      }));
      
      setPopularCategories(popularCatsWithCount);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      setError('ไม่สามารถโหลดข้อมูลสถิติได้');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, getCachedCategory]);

  useEffect(() => {
    if (!loading) {
      if (user) {
        fetchStatistics();
      } else {
        createMockStatistics();
      }
    }
  }, [user, loading, fetchStatistics, createMockStatistics]);

  return {
    stats,
    isLoading,
    categoryStats,
    popularCategories,
    error,
    refetch: user ? () => fetchStatistics(true) : createMockStatistics
  };
}; 