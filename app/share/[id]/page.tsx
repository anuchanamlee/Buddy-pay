'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BillResult } from '@/app/components/bill/BillResult';
import { Button, buttonVariants } from '@/app/components/ui/Button';
import { formatThaiDate } from '@/app/lib/format';
import { cn } from '@/lib/utils';
import { BillState } from '@/app/lib/billTypes';
import { getAppUrl } from '@/app/lib/utils';
import { useAuthModal } from '@/app/context/AuthModalContext';
import { useAuth } from '@/app/context/AuthContext';

// Firestore
import { db } from '@/app/lib/firebase';
import { invalidateStatsCache } from '@/app/hooks/useStatistics';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface SharedBillData extends BillState {
  expiryDate: string;
  createdAt: string;
  promptPayId?: string;
  qrPayload?: string;
  notes?: string;
  isTemporary?: boolean;
  shareId?: string;
  type?: string;
}

export default function SharedBillPage() {
  const params = useParams();
  const router = useRouter();
  const [billData, setBillData] = useState<SharedBillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openSignupModal } = useAuthModal();
  const { isAuthenticated, user } = useAuth();
  const shouldSaveBill = useRef(false);

  // โหลดบิลจาก API
  useEffect(() => {
    const fetchSharedBill = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/share/${params.id}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to load shared bill');
        setBillData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchSharedBill();
  }, [params.id]);

  // ฟังก์ชันบันทึกบิลลง Firestore
  const saveBillToFirestore = async (data: SharedBillData) => {
    if (!user) return;
    try {
      const payload = {
        name: data.billName,
        categoryId: data.categoryId || 'uncategorized',
        splitMethod: data.splitMethod,
        foodItems: data.foodItems,
        participants: data.participants,
        discount: Number(data.discount) || 0,
        vat: Number(data.vat) || 0,
        serviceCharge: Number(data.serviceCharge) || 0,
        totalAmount: data.totalAmount,
        splitResults: data.splitResults || [],
        status: 'pending',
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'bills'), payload);
      invalidateStatsCache();
      router.push(`/bill/${docRef.id}`);
    } catch (err) {
      console.error('Error saving bill:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกบิล');
    }
  };

  // ถ้า login แล้วและ flag shouldSaveBill เป็น true → บันทึกทันที
  useEffect(() => {
    if (isAuthenticated && shouldSaveBill.current && billData) {
      saveBillToFirestore(billData);
      shouldSaveBill.current = false;
    }
  }, [isAuthenticated, billData]);

  const handleLoginAndSaveBill = () => {
    if (isAuthenticated) {
      if (billData) saveBillToFirestore(billData);
    } else {
      shouldSaveBill.current = true;
      // ล็อกอินเสร็จให้กลับมาหน้านี้ (เดิมถูกพาไปหน้าแรก)
      try {
        sessionStorage.setItem('returnUrl', window.location.pathname);
      } catch {
        /* ไม่เป็นไร */
      }
      openSignupModal();
    }
  };

  // --- UI state: loading, error, not found ---
  if (loading) return <div className="pt-12 text-center text-muted-foreground">กำลังโหลดบิล...</div>;
  if (error || !billData) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
        <h1 className="text-xl font-bold text-foreground">เปิดบิลนี้ไม่ได้</h1>
        <p className="mt-2 text-muted-foreground">{error || 'ไม่พบข้อมูลบิล'} ลิงก์ใช้ได้ 24 ชั่วโมงหลังสร้าง ขอลิงก์ใหม่จากคนที่ส่งมาได้</p>
        <Link href="/share-bill" className={cn(buttonVariants(), 'mt-6')}>หารบิลของคุณเอง</Link>
      </div>
    );
  }

  const results = billData.splitResults || [];
  const total = billData.totalAmount || results.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="min-h-screen bg-background pb-12 pt-6">
      <div className="mx-auto max-w-2xl px-4">
        <p className="mb-4 rounded-lg bg-jade-50 px-3 py-2 text-sm text-jade-900">
          บิลที่เพื่อนส่งมา ลิงก์ใช้ได้ถึง {formatThaiDate(billData.expiryDate)}
        </p>
        <BillResult
          mode="shared"
          billName={billData.billName || 'บิลที่แชร์'}
          date={new Date(billData.createdAt)}
          participants={billData.participants || []}
          foodItems={billData.foodItems || []}
          results={results}
          extras={{ vat: Number(billData.vat) || 0, serviceCharge: Number(billData.serviceCharge) || 0, discount: Number(billData.discount) || 0 }}
          total={total}
          promptPayId={billData.promptPayId || ''}
          notes={billData.notes || ''}
          shareUrl={`${getAppUrl()}/share/${params.id}`}
        />

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:justify-between">
          <Link href="/share-bill" className={buttonVariants({ variant: 'outline' })}>หารบิลของคุณเอง</Link>
          <Button variant="secondary" onClick={handleLoginAndSaveBill}>
            {isAuthenticated ? 'เก็บบิลนี้ไว้ในบัญชีของฉัน' : 'ล็อกอินแล้วเก็บบิลนี้'}
          </Button>
        </div>
      </div>
    </div>
  );
}
