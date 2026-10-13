'use client';

import { formatThaiDate, formatTHB } from '@/app/lib/format';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import LoginPrompt from '../components/LoginPrompt';
import { mockBills } from '../lib/mockData';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/Card';
import { Users, Trash2, Receipt, Plus, AlertCircle } from 'lucide-react';
import { BillPayments, BillStatusBadge } from '../components/history/BillPayments';
import { applyPaymentStatus, type PaymentStatus } from '../components/history/paymentLogic';
import { useRouter } from 'next/navigation';
import { CategoryIcon } from '../components/CategorySelect';

import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  runTransaction,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  DocumentData,
  QueryDocumentSnapshot,
  deleteDoc
} from 'firebase/firestore';

import { Button } from '@/app/components/ui/Button';
import { cn } from '@/lib/utils';
import localforage from 'localforage';
import { BillHistoryPageSkeleton } from '../components/SkeletonLoaders';
import { InlineLoader } from '../components/ui/PageLoader';

const BILLS_PER_PAGE = 9; // จำนวนบิลต่อหน้า

export const dynamic = 'force-dynamic';

export default function BillHistory() {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
    const router = useRouter();
  // State สำหรับ pagination
  const [page, setPage] = useState(1);
  // บิลที่กำลังบันทึกอยู่ (หลายบิลพร้อมกันได้ แต่บิลเดียวกันห้ามซ้อน)
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingBills, setSavingBills] = useState<Set<string>>(() => new Set());
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const billsRef = useRef<any[]>([]);
  billsRef.current = bills;
  const [isRealtime, setIsRealtime] = useState(false);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);
  
  // ฟังก์ชันสำหรับแคชข้อมูลบิล
  const cacheBills = async (bills: any[]) => {
    if (!user) return;
    try {
      await localforage.setItem(`bills_${user.uid}`, {
        timestamp: Date.now(),
        data: bills
      });
    } catch (error) {
      console.error('Error caching bills:', error);
    }
  };
  
  // ฟังก์ชันสำหรับดึงข้อมูลบิลจากแคช
  const getBillsFromCache = async () => {
    if (!user) return null;
    try {
      const cached = await localforage.getItem(`bills_${user.uid}`);
      // ใช้แคชที่มีอายุไม่เกิน 5 นาที
      if (cached && Date.now() - (cached as any).timestamp < 300000) {
        return (cached as any).data;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached bills:', error);
      return null;
    }
  };

  // ฟังก์ชันดึงข้อมูลบิลจาก Firestore แบบ pagination
  const fetchBills = async (resetPagination = false) => {
    if (resetPagination) {
      setPage(1);
      setLastDoc(null);
    }
    setLoadError(null);
    
    try {
      setLoading(true);
      
      if (!isAuthenticated || !user) {
        // ถ้าไม่ได้ล็อกอินให้ใช้ข้อมูลตัวอย่าง
        // เตรียมข้อมูลตัวอย่างให้มีรูปแบบที่ถูกต้อง
        const preparedMockBills = mockBills.map(bill => ({
          ...bill,
          userId: 'mock-user-id', // เพิ่ม userId เพื่อให้สามารถใช้งานปุ่มชำระทั้งหมดได้
          createdAt: bill.createdAt instanceof Date ? bill.createdAt : new Date(), // ตรวจสอบความถูกต้องของวันที่
          date: bill.date instanceof Date ? bill.date : new Date() // ตรวจสอบความถูกต้องของวันที่
        }));
        
        setBills(preparedMockBills);
        setLoading(false);
        return preparedMockBills;
      }
      
      // ใช้ข้อมูลจากแคชก่อนถ้ามี (เฉพาะตอนโหลดครั้งแรก)
      if (resetPagination) {
        const cachedBills = await getBillsFromCache();
        if (cachedBills) {
          setBills(cachedBills);
          setLoading(false);
        }
      }
      
      // สร้าง query
      let billsQuery = query(
        collection(db, 'bills'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(BILLS_PER_PAGE)
      );
      
      // ถ้ามีเอกสารล่าสุด ให้ดึงข้อมูลถัดไป
      if (lastDoc && !resetPagination) {
        billsQuery = query(billsQuery, startAfter(lastDoc));
      }
      
      const querySnapshot = await getDocs(billsQuery);
      
      // บันทึกเอกสารล่าสุดสำหรับการทำ pagination
      if (querySnapshot.docs.length > 0) {
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMore(querySnapshot.docs.length === BILLS_PER_PAGE);
      } else {
        setHasMore(false);
      }
      
      const fetchedBills = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // อัพเดต state
      if (resetPagination) {
        setBills(fetchedBills);
        cacheBills(fetchedBills); // บันทึกลงแคช
      } else {
        setBills(prev => [...prev, ...fetchedBills]);
        cacheBills([...bills, ...fetchedBills]); // บันทึกลงแคชรวมกับข้อมูลเดิม
      }
      
      return fetchedBills;
    } catch (error) {
      console.error('Error fetching bills:', error);
      
      // ล็อกอินอยู่แต่โหลดไม่สำเร็จ: บอกผู้ใช้ตรง ๆ และให้ลองใหม่ (เดิมแสดงข้อมูลตัวอย่างแทน ทำให้เข้าใจผิดว่าเป็นบิลจริง)
      setLoadError('โหลดประวัติบิลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วกดลองอีกครั้ง');
      return bills;
    } finally {
      setLoading(false);
    }
  };
  
  // ติ๊กสถานะการจ่ายของผู้เข้าร่วมหนึ่งคน (optimistic: อัพเดตหน้าจอก่อน ถ้าบันทึกไม่สำเร็จจะย้อนกลับ)
  const togglePayment = async (billId: string, participantId: string, newStatus: PaymentStatus) => {
    const current = billsRef.current.find((b) => b.id === billId);
    if (!current || savingBills.has(billId)) return;
    const previousStatus: PaymentStatus = newStatus === 'paid' ? 'pending' : 'paid';

    const applyToState = (status: PaymentStatus) => {
      const next = billsRef.current.map((b) =>
        b.id === billId ? { ...b, ...applyPaymentStatus(b, participantId, status) } : b
      );
      billsRef.current = next;
      setBills(next);
      return next;
    };

    setPaymentErrors((prev) => {
      const { [billId]: _removed, ...rest } = prev;
      return rest;
    });

    applyToState(newStatus);

    // ข้อมูลตัวอย่าง (ยังไม่ล็อกอิน): เปลี่ยนในเครื่องเท่านั้น ไม่เขียน Firestore
    if (!isAuthenticated || !user || String(billId).startsWith('mock-')) return;

    setSavingBills((prev) => new Set(prev).add(billId));
    try {
      // อ่านบิลล่าสุดจาก Firestore แล้วเปลี่ยนเฉพาะคนนี้ใน transaction
      // กันกรณีหน้าจอแสดงข้อมูลเก่าจากแคช แล้วเขียนทับสถานะที่เพิ่งติ๊กจากหน้ารายละเอียด
      const fresh = await runTransaction(db, async (tx) => {
        const ref = doc(db, 'bills', billId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('bill not found');
        const latest = { id: billId, ...snap.data() } as typeof current;
        const next = applyPaymentStatus(latest, participantId, newStatus);
        const payload: DocumentData = { participants: next.participants, status: next.status };
        if (next.splitResults !== undefined) payload.splitResults = next.splitResults;
        tx.update(ref, payload);
        return { ...latest, ...next };
      });
      // ใช้ข้อมูลจาก Firestore เป็นหลัก (อาจมีคนอื่นที่ถูกติ๊กจากที่อื่นด้วย)
      const synced = billsRef.current.map((b) => (b.id === billId ? { ...b, participants: fresh.participants, splitResults: fresh.splitResults, status: fresh.status } : b));
      billsRef.current = synced;
      setBills(synced);
      void cacheBills(billsRef.current);
    } catch (error) {
      console.error('Error updating payment status:', error);
      applyToState(previousStatus);
      void cacheBills(billsRef.current);
      const person = current.participants?.find((p: any) => p.id === participantId)?.name || 'ผู้เข้าร่วม';
      setPaymentErrors((prev) => ({
        ...prev,
        [billId]: `บันทึกสถานะของ ${person} ไม่สำเร็จ ระบบคืนค่าเดิมให้แล้ว กรุณาลองใหม่อีกครั้ง`,
      }));
    } finally {
      setSavingBills((prev) => {
        const next = new Set(prev);
        next.delete(billId);
        return next;
      });
    }
  };

  // ใช้ Snapshot Listener เมื่อต้องการฟังการเปลี่ยนแปลงแบบ real-time
  const setupRealtimeListener = () => {
    if (!isAuthenticated || !user) return undefined;
    
    setIsRealtime(true);
    
    const billsQuery = query(
      collection(db, 'bills'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(BILLS_PER_PAGE)
    );
    
    const unsubscribe = onSnapshot(billsQuery, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setBills(billsData);
      cacheBills(billsData);
      setLoading(false);
    }, (error) => {
      console.error('Error in snapshot listener:', error);
      setLoading(false);
      setIsRealtime(false);
    });
    
    // คืนค่า unsubscribe function เพื่อให้ useEffect cleanup
    return unsubscribe;
  };
  
  // โหลดข้อมูลเมื่อคอมโพเนนต์ถูกโหลด
  useEffect(() => {
    // ตัวแปรเก็บสถานะว่า component ยังทำงานอยู่หรือไม่
    let isMounted = true;
    
    // พยายามโหลดจากแคชก่อน
    const loadInitialData = async () => {
      if (!isMounted) return;
      
      const cachedBills = await getBillsFromCache();
      if (cachedBills && isMounted) {
        setBills(cachedBills);
        setLoading(false);
      }
      
      // โหลดข้อมูลใหม่เสมอ
      try {
        if (isMounted) {
          fetchBills(true);
        }
      } catch (error) {
        console.error('Error loading bills:', error);
      }
    };
    
    loadInitialData();
    
    // ตั้งค่า real-time listener
    let unsubscribe: (() => void) | undefined;
    
    if (isRealtime && isMounted) {
      unsubscribe = setupRealtimeListener();
    }
    
    // Cleanup
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isAuthenticated, user, isRealtime]);
  
  // ฟังก์ชันโหลดข้อมูลเพิ่มเติม
  const loadMore = () => {
    if (loading || !hasMore) return;
    if (process.env.NODE_ENV === 'development') {
      console.log('Loading page:', page + 1); // Log current page for debugging
    }
    setPage(prev => prev + 1);
    fetchBills(false);
  };
  
  // ฟังก์ชันแปลงวันที่ (รองรับ Date, Firestore Timestamp และค่าจากแคช)
  const formatDate = (dateInput: Parameters<typeof formatThaiDate>[0]) => formatThaiDate(dateInput);
  
  // ฟังก์ชันลบบิล
  const deleteBill = async (billId: string, billName: string) => {
    if (!isAuthenticated || !user) {
      alert("กรุณาเข้าสู่ระบบเพื่อลบบิล");
      return;
    }

    // ยืนยันการลบ
    const isConfirmed = window.confirm(
      `คุณต้องการลบบิล "${billName}" หรือไม่?\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`
    );

    if (!isConfirmed) return;

    try {
      setDeletingBillId(billId);

      // ลบบิลจาก Firestore
      await deleteDoc(doc(db, 'bills', billId));

      // อัพเดต state โดยลบบิลออกจากรายการ
      setBills(prevBills => prevBills.filter(bill => bill.id !== billId));

      // ลบจากแคชด้วย
      const remainingBills = bills.filter(bill => bill.id !== billId);
      await cacheBills(remainingBills);

      alert("ลบบิลสำเร็จ");
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert("เกิดข้อผิดพลาดในการลบบิล กรุณาลองใหม่อีกครั้ง");
    } finally {
      setDeletingBillId(null);
    }
  };

  // Toggle real-time updates


  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">ประวัติบิล</h1>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchBills(true);
            }}
            disabled={loading}
          >
            {loading ? 'กำลังรีเฟรช...' : 'รีเฟรช'}
          </Button>
        </div>
      </div>
      
      {!isAuthenticated && (
        <LoginPrompt message="คุณกำลังดูข้อมูลตัวอย่าง" />
      )}

      {loadError && (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchBills(true); }}>
            ลองอีกครั้ง
          </Button>
        </div>
      )}
      {loading && bills.length === 0 ? (
        <BillHistoryPageSkeleton />
      ) : bills.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {bills.map((bill) => (
              <Card
                key={bill.id}
                role="group"
                tabIndex={isAuthenticated ? 0 : undefined}
                aria-label={bill.name || bill.title || 'บิลไม่มีชื่อ'}
                className={cn(
                  'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  deletingBillId === bill.id ? 'cursor-not-allowed opacity-50' : isAuthenticated ? 'cursor-pointer' : ''
                )}
                onClick={() => {
                  if (deletingBillId === bill.id || !isAuthenticated) return;
                  router.push(`/bill/${bill.id}`);
                }}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget || !isAuthenticated || deletingBillId === bill.id) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/bill/${bill.id}`);
                  }
                }}
              >
                <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex-1 truncate pr-2 text-base sm:text-lg">{bill.name || bill.title || 'บิลไม่มีชื่อ'}</CardTitle>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {bill.categoryId && (
                        <CategoryIcon categoryId={bill.categoryId} size={20} />
                      )}
                      {isAuthenticated && bill.userId === user?.uid && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBill(bill.id, bill.name || bill.title || 'บิลไม่มีชื่อ');
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="flex h-11 w-11 -m-2 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`ลบบิล ${bill.name || bill.title || 'บิลไม่มีชื่อ'}`}
                          disabled={deletingBillId === bill.id}
                        >
                          {deletingBillId === bill.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                          ) : (
                            <Trash2 size={16} aria-hidden />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    {formatDate(bill.createdAt)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
                  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Users size={14} className="mr-1 sm:mr-2" aria-hidden />
                      <span className="text-xs sm:text-sm">{bill.participants?.length || 0} คน</span>
                    </div>
                    <div className="text-sm font-medium tabular-nums text-foreground sm:text-base">
                      {formatTHB(bill.totalAmount)} บาท
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <BillStatusBadge bill={bill} />
                    {isAuthenticated && (
                      <Link
                        href={`/bill/${bill.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        ดูบิล
                      </Link>
                    )}
                  </div>
                  <BillPayments
                    bill={bill}
                    canToggle={!isAuthenticated || bill.userId === user?.uid}
                    saving={savingBills.has(bill.id)}
                    onToggle={(pid, status) => togglePayment(bill.id, pid, status)}
                  />
                  {!isAuthenticated && (
                    <p className="text-xs text-muted-foreground">ข้อมูลตัวอย่าง การติ๊กจะไม่ถูกบันทึก</p>
                  )}
                  {paymentErrors[bill.id] && (
                    <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                      {paymentErrors[bill.id]}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {hasMore && (
            <div className="text-center mt-8">
              <Button 
                variant="outline" 
                className="mx-auto"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <InlineLoader size="sm" message="กำลังโหลด..." />
                ) : (
                  'โหลดเพิ่มเติม'
                )}
              </Button>
            </div>
          )}
        </>
      ) : loadError ? null : (
        <div className="text-center py-12 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />
          <p className="font-semibold text-gray-800">ยังไม่มีบิลที่บันทึกไว้</p>
          <p className="mt-1 text-sm text-gray-500">หารบิลครั้งแรกแล้วกดบันทึก บิลจะมาอยู่ที่นี่ให้ติดตามว่าใครจ่ายแล้วบ้าง</p>
          <Button className="mt-5" onClick={() => router.push('/share-bill')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            สร้างบิลใหม่
          </Button>
        </div>
      )}

      {loading && <p className="text-center text-gray-500 font-semibold mt-2">กำลังโหลดข้อมูลใหม่...</p>}
    </div>
  );
} 