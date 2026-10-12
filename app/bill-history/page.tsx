'use client';

import { formatThaiDate } from '@/app/lib/format';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LoginPrompt from '../components/LoginPrompt';
import { mockBills } from '../lib/mockData';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/app/components/ui/Card';
import { Users, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CategoryIcon } from '../components/CategorySelect';

import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  writeBatch,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  DocumentData,
  QueryDocumentSnapshot,
  deleteDoc
} from 'firebase/firestore';

import { Button } from '@/app/components/ui/Button';
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
  const [isSaving, setIsSaving] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
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
      
      // ถ้าเกิดข้อผิดพลาดและเป็นการโหลดครั้งแรก ให้ใช้ข้อมูลตัวอย่าง
      if (resetPagination && bills.length === 0) {
        // เตรียมข้อมูลตัวอย่างให้มีรูปแบบที่ถูกต้อง
        const preparedMockBills = mockBills.map(bill => ({
          ...bill,
          userId: 'mock-user-id', // เพิ่ม userId เพื่อให้สามารถใช้งานปุ่มชำระทั้งหมดได้
          createdAt: bill.createdAt instanceof Date ? bill.createdAt : new Date(), // ตรวจสอบความถูกต้องของวันที่
          date: bill.date instanceof Date ? bill.date : new Date() // ตรวจสอบความถูกต้องของวันที่
        }));
        setBills(preparedMockBills);
      }
      
      if (bills.length > 0) {
        return bills;
      } else {
        // เตรียมข้อมูลตัวอย่างให้มีรูปแบบที่ถูกต้อง
        const preparedMockBills = mockBills.map(bill => ({
          ...bill,
          userId: 'mock-user-id', // เพิ่ม userId เพื่อให้สามารถใช้งานปุ่มชำระทั้งหมดได้
          createdAt: bill.createdAt instanceof Date ? bill.createdAt : new Date(), // ตรวจสอบความถูกต้องของวันที่
          date: bill.date instanceof Date ? bill.date : new Date() // ตรวจสอบความถูกต้องของวันที่
        }));
        return preparedMockBills;
      }
    } finally {
      setLoading(false);
    }
  };
  
  // หมายเหตุ: ใช้ updateAllParticipants แทน mutation สำหรับอัพเดตสถานะ
  
  // ฟังก์ชันสำหรับ batch update สำหรับอัพเดตสถานะทั้งบิล
  const updateAllParticipants = async (billId: string, newStatus: 'paid' | 'pending') => {
    if (!isAuthenticated) {
      alert("กรุณาเข้าสู่ระบบเพื่อดำเนินการ");
      return;
    }
    
    try {
      setIsSaving(true);
      
      const billToUpdate = bills.find(bill => bill.id === billId);
      if (!billToUpdate) {
        alert("ไม่พบบิลที่ต้องการอัพเดต");
        return;
      }
      
      // ตรวจสอบว่าบิลนี้มีสถานะที่ต้องการอัพเดตอยู่แล้วหรือไม่
      if (billToUpdate.status === newStatus) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Bill status is already', newStatus);
        }
        return;
      }

      // อัพเดตสถานะของผู้เข้าร่วมทุกคน
      const updatedParticipants = billToUpdate.participants.map((p: any) => ({
        ...p,
        status: newStatus
      }));
      
      // ตรวจสอบว่าเป็นการใช้ข้อมูลจำลองหรือไม่
      if (billToUpdate.id.startsWith('mock-') || !user) {
        // กรณีใช้ข้อมูลจำลอง เพียงอัพเดต state โดยตรง
        setBills(prevBills => prevBills.map(bill => {
          if (bill.id === billId) {
            return {
              ...bill,
              participants: updatedParticipants,
              status: newStatus
            };
          }
          return bill;
        }));
      } else {
        // กรณีใช้ข้อมูลจริง อัพเดตลง Firebase
        // ใช้ batch สำหรับการอัพเดตหลายรายการพร้อมกัน
        const batch = writeBatch(db);
        const billRef = doc(db, 'bills', billId);
        
        // เพิ่มการอัพเดตเข้า batch
        batch.update(billRef, {
          participants: updatedParticipants,
          status: newStatus
        });
        
        // ทำการ commit batch
        await batch.commit();
        
        // อัพเดต state หลังจาก commit สำเร็จ
        setBills(prevBills => prevBills.map(bill => {
          if (bill.id === billId) {
            return {
              ...bill,
              participants: updatedParticipants,
              status: newStatus
            };
          }
          return bill;
        }));
        
        // อัพเดตแคช
        cacheBills(bills);
      }
    } catch (error) {
      console.error('Error updating all participants:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดตสถานะการชำระเงิน');
    } finally {
      setIsSaving(false);
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
  
  // ฟังก์ชันคำนวณสถานะบิล
  const calculateBillStatus = (bill: any) => {
    if (!bill.participants || bill.participants.length === 0) {
      return 'pending';
    }
    
    const allPaid = bill.participants.every((p: any) => p.status === 'paid');
    return allPaid ? 'paid' : 'pending';
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
            className={`text-xs sm:text-sm ${loading ? 'bg-blue-200' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
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

      {loading && bills.length === 0 ? (
        <BillHistoryPageSkeleton />
      ) : bills.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {bills.map((bill) => (
              <Card 
                key={bill.id} 
                className={`hover:shadow-md transition-shadow ${
                  deletingBillId === bill.id 
                    ? 'opacity-50 cursor-not-allowed' 
                    : isAuthenticated 
                      ? 'cursor-pointer' 
                      : 'cursor-not-allowed opacity-90'
                }`}
                onClick={() => {
                  if (deletingBillId === bill.id) return; // ป้องกันการคลิกขณะลบ
                  if (isAuthenticated) {
                    router.push(`/bill/${bill.id}`);
                  } else {
                    // แสดงข้อความหรือเปิด login modal
                    alert('กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดบิล');
                  }
                }}
              >
                <CardHeader className="pb-3 p-4 sm:p-6">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base sm:text-lg flex-1 truncate pr-2">{bill.name || bill.title || 'บิลไม่มีชื่อ'}</CardTitle>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {bill.categoryId && (
                        <CategoryIcon categoryId={bill.categoryId} size={20} />
                      )}
                      {isAuthenticated && bill.userId === user?.uid && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBill(bill.id, bill.name || bill.title || 'บิลไม่มีชื่อ');
                          }}
                          className={`p-1 rounded transition-colors ${
                            deletingBillId === bill.id 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title={deletingBillId === bill.id ? "กำลังลบ..." : "ลบบิล"}
                          disabled={deletingBillId === bill.id}
                        >
                          {deletingBillId === bill.id ? (
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">
                    {formatDate(bill.createdAt)}
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center">
                      <Users size={14} className="mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">{bill.participants?.length || 0} คน</span>
                    </div>
                    <div className="font-medium text-sm sm:text-base">
                      {bill.totalAmount?.toLocaleString() || 0} บาท
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-3 p-4 sm:p-6">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs sm:text-sm">สถานะ:</span>
                    {calculateBillStatus(bill) === 'paid' ? (
                      <span className="text-xs sm:text-sm flex items-center text-green-600">
                        <CheckCircle2 size={14} className="mr-1" />
                        ชำระแล้ว
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm flex items-center text-amber-600">
                          <XCircle size={14} className="mr-1" />
                          รอชำระ
                        </span>
                        {isAuthenticated && bill.userId === user?.uid && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 px-2 sm:h-8 sm:px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateAllParticipants(bill.id, 'paid');
                            }}
                            disabled={isSaving}
                          >
                            {isSaving ? 'กำลังบันทึก...' : 'ชำระทั้งหมด'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardFooter>
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
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">ไม่พบประวัติบิล</p>
        </div>
      )}

      {loading && <p className="text-center text-gray-500 font-semibold mt-2">กำลังโหลดข้อมูลใหม่...</p>}
    </div>
  );
} 