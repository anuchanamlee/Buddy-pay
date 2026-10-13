"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Bill, FoodItem } from "../../lib/schema";
import { calculateSplit } from "../../lib/billCalculator";
import { PerPersonPromptPayQR, sanitizePromptPayId } from "../../components/PromptPayQR";
import { formatTHB } from "../../lib/format";
import { useParams, useRouter } from "next/navigation";
import { FirebaseProvider, useFirebase } from "../../components/providers/FirebaseWrapper";
import { useAuthModal } from "../../context/AuthModalContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { CalendarIcon, ArrowLeft, CheckCircle2, XCircle, Save } from "lucide-react";
import { CategoryIcon } from "../../components/CategorySelect";

/**
 * Types
 */
type BillWithId = Bill & { id: string; splitResults?: any[]; promptPayId?: string };
type FireTS = { seconds: number; nanoseconds: number };

/**
 * Utils
 */
const formatCurrency = (n: number) =>
  (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isFireTS = (d: unknown): d is FireTS =>
  typeof d === "object" && !!d && "seconds" in (d as any) && "nanoseconds" in (d as any);

const toDisplayDate = (date: Date | string | FireTS | undefined) => {
  if (!date) return "-";
  try {
    if (typeof date === "object" && Object.keys(date).length === 0) return "ไม่ระบุวันที่";
    const jsDate = isFireTS(date)
      ? new Date((date as FireTS).seconds * 1000)
      : date instanceof Date
      ? date
      : new Date(date);
    if (Number.isNaN(jsDate.getTime())) return "วันที่ไม่ถูกต้อง";
    return jsDate.toLocaleString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

/**
 * Content
 */
function BillDetailContent() {
  const router = useRouter();
  const params = useParams();
  const billId = Array.isArray(params?.id) ? (params.id[0] as string) : (params?.id as string);

  const { user, loading } = useFirebase();
  const { openLoginModal } = useAuthModal();

  const [bill, setBill] = useState<BillWithId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // fetch bill
  const fetchBillDetail = useCallback(async () => {
    if (!billId) return;
    try {
      setIsLoading(true);
      setError(null);
      setUnauthorized(false);
      if (!user) {
        setUnauthorized(true);
        return;
      }
      const docRef = doc(db, "bills", billId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        setError("ไม่พบข้อมูลบิลที่ต้องการ");
        return;
      }
      const data = snap.data() as BillWithId;
      if ((data as any).userId !== user.uid) {
        if (process.env.NODE_ENV === "development") {
          console.log("Unauthorized: Bill belongs to", (data as any).userId, "but current user is", user.uid);
        }
        setUnauthorized(true);
        return;
      }
      setBill({ id: snap.id, ...(data as any) });
    } catch (e) {
      console.error("โหลดบิลผิดพลาด:", e);
      setError("ไม่สามารถโหลดข้อมูลบิลได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }, [billId, user]);

  useEffect(() => {
    if (!loading) {
      if (!user) openLoginModal();
      else fetchBillDetail();
    }
  }, [loading, user, fetchBillDetail, openLoginModal]);

  /**
   * Pure computations (memoized)
   */
  // ใช้สูตรเดียวกับหน้าผลลัพธ์ (billCalculator) ยอดจึงตรงกันทุกหน้า
  // เดิมหน้านี้คิดค่าบริการจากค่าอาหารแทนยอดหลัง VAT และไม่ปัดเป็นสตางค์
  const totals = useMemo(() => {
    if (!bill) return { food: 0, vatAmt: 0, svcAmt: 0, discount: 0, grand: 0 };
    const food = (bill.foodItems || []).reduce((s, it) => s + (Number(it.price) || 0), 0);
    const vatAmt = (food * (bill.vat || 0)) / 100;
    const svcAmt = ((food + vatAmt) * (bill.serviceCharge || 0)) / 100;
    const discount = bill.discount || 0;
    const grand = Math.max(0, food + vatAmt + svcAmt - discount);
    return { food, vatAmt, svcAmt, discount, grand };
  }, [bill]);

  const participantShares = useMemo(() => {
    if (!bill) return {} as Record<string, number>;
    const shares: Record<string, number> = {};
    calculateSplit({
      ...bill,
      foodItems: (bill.foodItems || []).map((it) => ({ ...it, price: Number(it.price) || 0, participants: it.participants || [] })),
      participants: bill.participants || [],
      vat: bill.vat || 0,
      serviceCharge: bill.serviceCharge || 0,
      discount: bill.discount || 0,
    }).forEach((r) => (shares[r.participant.id] = r.amount));
    return shares;
  }, [bill]);

  const unassignedParticipants = useMemo(() => {
    if (!bill || bill.splitMethod !== "itemized") return [] as string[];
    const picked = new Set<string>();
    (bill.foodItems || []).forEach((it) => it.participants?.forEach((pid) => picked.add(pid)));
    return (bill.participants || []).filter((p) => !picked.has(p.id)).map((p) => p.id);
  }, [bill]);

  /**
   * Mutations (immutable updates)
   */
  // เพิ่ม/แก้/ลบเมนู
  const handleAddFoodItem = () => {
    setBill((prev) => {
      if (!prev) return prev;
      const newItem: FoodItem = {
        id: `tmp-${Date.now()}`,
        name: "เมนูใหม่",
        price: 0,
        participants: [],
      } as unknown as FoodItem;
      return { ...prev, foodItems: [...(prev.foodItems || []), newItem] };
    });
    setIsEdited(true);
  };

  const handleUpdateFoodItem = (id: string, field: keyof FoodItem, value: any) => {
    setBill((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        foodItems: (prev.foodItems || []).map((it: any) =>
          it.id === id ? { ...it, [field]: field === "price" ? Number(value) || 0 : value } : it
        ),
      };
    });
    setIsEdited(true);
  };

  const handleDeleteFoodItem = (id: string) => {
    const ok = typeof window !== "undefined" ? window.confirm("ลบรายการอาหารนี้หรือไม่?") : true;
    if (!ok) return;
    setBill((prev) => {
      if (!prev) return prev;
      return { ...prev, foodItems: (prev.foodItems || []).filter((it: any) => it.id !== id) };
    });
    setIsEdited(true);
  };

  const handleParticipantToggle = useCallback((foodItemId: string, participantId: string) => {
    setBill((prev) => {
      if (!prev) return prev;
      const next: BillWithId = {
        ...prev,
        foodItems: (prev.foodItems || []).map((it: any) => {
          if (it.id !== foodItemId) return it;
          const has = (it.participants || []).includes(participantId);
          return {
            ...it,
            participants: has
              ? (it.participants || []).filter((p: string) => p !== participantId)
              : [...(it.participants || []), participantId],
          } as FoodItem;
        }),
      };
      return next;
    });
    setIsEdited(true);
  }, []);

  const handleToggleAllParticipantsForItem = (foodItemId: string, mode: "all" | "none") => {
    setBill((prev) => {
      if (!prev) return prev;
      const allIds = (prev.participants || []).map((p: any) => p.id);
      return {
        ...prev,
        foodItems: (prev.foodItems || []).map((it: any) =>
          it.id === foodItemId ? { ...it, participants: mode === "all" ? allIds : [] } : it
        ),
      };
    });
    setIsEdited(true);
  };

  // จัดการผู้ร่วมบิล
  const handleAddParticipant = () => {
    setBill((prev) => {
      if (!prev) return prev;
      const newP = { id: `p-${Date.now()}`, name: "ผู้ร่วมใหม่", status: "pending" } as any;
      return { ...prev, participants: [...(prev.participants || []), newP] };
    });
    setIsEdited(true);
  };

  const handleUpdateParticipantName = (participantId: string, name: string) => {
    setBill((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: (prev.participants || []).map((p: any) => (p.id === participantId ? { ...p, name } : p)),
      };
    });
    setIsEdited(true);
  };

  const handleRemoveParticipant = (participantId: string) => {
    const ok = typeof window !== "undefined" ? window.confirm("ลบผู้ร่วมบิลคนนี้หรือไม่?") : true;
    if (!ok) return;
    setBill((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: (prev.participants || []).filter((p: any) => p.id !== participantId),
        foodItems: (prev.foodItems || []).map((it: any) => ({
          ...it,
          participants: (it.participants || []).filter((pid: string) => pid !== participantId),
        })),
      };
    });
    setIsEdited(true);
  };

  const updatePaymentStatus = useCallback(
    async (participantId: string, newStatus: "paid" | "pending") => {
      if (!bill) return;
      try {
        setIsSaving(true);
        const updatedParticipants = bill.participants.map((p: any) =>
          p.id === participantId ? { ...p, status: newStatus } : p
        );
        const updatedSplitResults = Array.isArray(bill.splitResults)
          ? bill.splitResults.map((sr: any) =>
              sr.participant && sr.participant.id === participantId
                ? { ...sr, participant: { ...sr.participant, status: newStatus } }
                : sr
            )
          : bill.splitResults;

        const billRef = doc(db, "bills", bill.id);
        const allPaid = updatedParticipants.every((p: any) => p.status === "paid");
        const status = allPaid ? "paid" : "pending";
        await updateDoc(billRef, { participants: updatedParticipants, splitResults: updatedSplitResults, status });

        setBill((prev) =>
          prev ? { ...prev, participants: updatedParticipants, splitResults: updatedSplitResults, status } : prev
        );
      } catch (e) {
        console.error("อัพเดตสถานะการชำระเงินผิดพลาด:", e);
        alert("ไม่สามารถอัพเดตสถานะการชำระเงินได้ กรุณาลองใหม่อีกครั้ง");
      } finally {
        setIsSaving(false);
      }
    },
    [bill]
  );

  const updateAllPaymentStatus = useCallback(
    async (newStatus: "paid" | "pending") => {
      if (!bill) return;
      try {
        setIsSaving(true);
        const updatedParticipants = bill.participants.map((p: any) => ({ ...p, status: newStatus }));
        const updatedSplitResults = Array.isArray(bill.splitResults)
          ? bill.splitResults.map((sr: any) =>
              sr.participant ? { ...sr, participant: { ...sr.participant, status: newStatus } } : sr
            )
          : bill.splitResults;
        const billRef = doc(db, "bills", bill.id);
        await updateDoc(billRef, { participants: updatedParticipants, splitResults: updatedSplitResults, status: newStatus });
        setBill((prev) =>
          prev ? { ...prev, participants: updatedParticipants, splitResults: updatedSplitResults, status: newStatus } : prev
        );
      } catch (e) {
        console.error("อัพเดตทั้งบิลผิดพลาด:", e);
        alert("ไม่สามารถอัพเดตสถานะการชำระเงินได้ กรุณาลองใหม่อีกครั้ง");
      } finally {
        setIsSaving(false);
      }
    },
    [bill]
  );

  const handleSaveChanges = useCallback(async () => {
    if (!bill) return;
    try {
      setIsSaving(true);
      setSaveMessage(null);
  
      // 1) คำนวณยอดรวม (grand) จากรายการอาหาร + VAT + ServiceCharge - ส่วนลด
      const food = (bill.foodItems || []).reduce((s, it) => s + (Number(it.price) || 0), 0);
      const vatAmt = (food * (bill.vat || 0)) / 100;
      const svcAmt = (food * (bill.serviceCharge || 0)) / 100;
      const discount = bill.discount || 0;
      const grand = Math.max(0, food + vatAmt + svcAmt - discount);
  
      // 2) สถานะรวม (กันพลาด ถ้ามีการเปลี่ยนสถานะผู้ร่วมบิล)
      const allPaid = (bill.participants || []).every((p: any) => p.status === "paid");
      const status = allPaid ? "paid" : "pending";
  
      // 3) อัปเดต Firestore (เขียน totalAmount ด้วย)
      const { id: _omit, ...payload } = bill;
      await updateDoc(doc(db, "bills", bill.id), {
        ...payload,
        totalAmount: grand,       // ✅ ให้ bill-history เห็นยอดใหม่
        status,                   // ✅ sync สถานะรวม
        // updatedAt: serverTimestamp() // ถ้าใช้ serverTimestamp ให้ import จาก firebase/firestore
        updatedAt: new Date(),    // ใช้ Date ปกติถ้า schema ไม่ได้ใช้ serverTimestamp
      } as any);
  
      // 4) อัปเดต state หน้านี้ให้ตรงกับที่เพิ่งบันทึก
      setBill(prev => prev ? { ...prev, totalAmount: grand, status } as any : prev);
  
      setIsEdited(false);
      setIsEditMode(false); // ✅ กลับโหมดดูหลังบันทึกสำเร็จ
      setSaveMessage({ type: "success", text: "บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว" });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      console.error("บันทึกข้อมูลผิดพลาด:", e);
      setSaveMessage({ type: "error", text: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setIsSaving(false);
    }
  }, [bill]);
  
  

  const handleToggleEditMode = () => {
    if (isEditMode) {
      // กำลังจะออกจากโหมดแก้ไข
      if (isEdited) {
        const ok = typeof window !== "undefined" ? window.confirm("ยกเลิกการแก้ไขที่ยังไม่ได้บันทึก?") : true;
        if (!ok) return;
        // รีเฟตช์ทับเพื่อย้อนกลับสถานะ
        fetchBillDetail();
        setIsEdited(false);
      }
      setIsEditMode(false);
    } else {
      setIsEditMode(true);
    }
  };

  /**
   * Render branches
   */
  if (loading || (isLoading && user)) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-8 mx-auto bg-blue-400 rounded-full mb-4 animate-spin" />
          <div className="h-6 w-32 mx-auto bg-gray-200 rounded mb-2" />
          <div className="h-4 w-48 mx-auto bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6">รายละเอียดบิล</h1>
          <p className="text-muted-foreground mb-6">กรุณาเข้าสู่ระบบเพื่อดูรายละเอียดบิล</p>
          <Button onClick={openLoginModal}>เข้าสู่ระบบ</Button>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="text-center">
          <div className="bg-red-100 text-red-800 p-6 rounded-lg mb-6">
            <h1 className="text-3xl font-bold mb-3">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="mb-0">คุณไม่มีสิทธิ์เข้าถึงข้อมูลบิลนี้</p>
          </div>
          <Button onClick={() => router.push("/bill-history")}>กลับไปหน้าประวัติบิล</Button>
        </div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="text-center">
          <div className="bg-red-100 text-red-800 p-6 rounded-lg mb-6">
            <h1 className="text-3xl font-bold mb-3">เกิดข้อผิดพลาด</h1>
            <p className="mb-0">{error || "ไม่พบข้อมูลบิล"}</p>
          </div>
          <Button onClick={() => router.push("/bill-history")}>กลับไปหน้าประวัติบิล</Button>
        </div>
      </div>
    );
  }

  /**
   * UI
   */
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Button variant="outline" className="mb-4 flex items-center" onClick={() => router.push("/bill-history")}>
          <ArrowLeft size={16} className="mr-2" />
          กลับไปหน้าประวัติบิล
        </Button>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{bill.name}</h1>
          {bill.categoryId && (
            <div className="flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
              <CategoryIcon categoryId={bill.categoryId} size={20} />
            </div>
          )}
        </div>
        <div className="flex items-center text-gray-500 mt-2">
          <CalendarIcon size={16} className="mr-1" />
          <span>{toDisplayDate(bill.createdAt as any)}</span>
        </div>

        {bill.splitMethod === "itemized" && unassignedParticipants.length > 0 && (
          <div className="mt-4 p-3 rounded-md bg-yellow-100 text-yellow-700">
            <span className="font-semibold">คำเตือน:</span> มีผู้เข้าร่วมบางคนยังไม่ได้เลือกรายการอาหาร กรุณาเลือกว่าใครกินอะไรบ้าง
          </div>
        )}

        {saveMessage && (
          <div
            className={`mt-4 p-3 rounded-md ${
              saveMessage.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center">
            <div
              className={`flex items-center rounded-full px-3 py-1 text-sm ${
                bill.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {bill.status === "paid" ? (
                <>
                  <CheckCircle2 size={16} className="mr-1" />
                  <span>ชำระแล้ว</span>
                </>
              ) : (
                <>
                  <XCircle size={16} className="mr-1" />
                  <span>รอชำระ</span>
                </>
              )}
            </div>
            <div className="ml-3">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => updateAllPaymentStatus(bill.status === "paid" ? "pending" : "paid")}
                disabled={isSaving}
              >
                {isSaving ? "กำลังบันทึก..." : bill.status === "paid" ? "เปลี่ยนเป็นรอชำระ" : "เปลี่ยนเป็นชำระแล้ว"}
              </Button>
            </div>
          </div>
          <div>
            <Button variant="outline" size="sm" className="text-xs" onClick={handleToggleEditMode}>
              {isEditMode ? "ยกเลิกแก้ไข" : "แก้ไขบิล"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>รายการอาหาร</span>
                <span className="text-sm font-normal text-gray-500">
                  วิธีการหาร: {bill.splitMethod === "equal" ? "หารเท่ากันหมด" : "หารตามรายการที่สั่ง"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditMode && (
                <div className="mb-3">
                  <Button variant="outline" size="sm" onClick={handleAddFoodItem}>
                    + เพิ่มเมนูอาหาร
                  </Button>
                </div>
              )}
              <div className="space-y-4">
                {(bill.foodItems || []).map((item: any) => (
                  <div key={item.id} className="p-3 border rounded-md">
                    {!isEditMode && (
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            {Number(item.price || 0).toLocaleString()} บาท
                          </p>
                        </div>
                        <div className="text-right">
                          {bill.splitMethod === "equal" ? (
                            <div className="text-gray-500 italic text-sm">ทุกคนร่วมจ่ายเท่ากัน</div>
                          ) : (
                            <div className="flex flex-wrap justify-end gap-1 mt-1">
                              {(bill.participants || []).map((p: any) => {
                                const active = (item.participants || []).includes(p.id);
                                const per = active
                                  ? (Number(item.price || 0) / Math.max(1, (item.participants || []).length)).toLocaleString(
                                      "th-TH",
                                      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                    )
                                  : null;
                                return (
                                  <span
                                    key={`${item.id}-${p.id}`}
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      active ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {p.name}
                                    {active && <span className="ml-1">({per} บาท)</span>}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {isEditMode && (
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={item.name || ""}
                            onChange={(e) => handleUpdateFoodItem(item.id, "name" as any, e.target.value)}
                            className="border rounded px-3 py-2 w-full"
                            placeholder="ชื่อเมนู"
                          />
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={item.price ?? 0}
                            onChange={(e) => handleUpdateFoodItem(item.id, "price" as any, e.target.value)}
                            className="border rounded px-3 py-2 w-full"
                            placeholder="ราคา"
                          />
                          <div className="flex items-center justify-end gap-2">
                            {bill.splitMethod === "itemized" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleAllParticipantsForItem(item.id, "all")}
                                >
                                  เลือกทุกคน
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleAllParticipantsForItem(item.id, "none")}
                                >
                                  ล้าง
                                </Button>
                              </>
                            )}
                            <Button variant="danger" size="sm" onClick={() => handleDeleteFoodItem(item.id)}>
                              ลบเมนูนี้
                            </Button>
                          </div>
                        </div>

                        {bill.splitMethod === "itemized" && (
                          <div className="flex flex-wrap gap-2">
                            {(bill.participants || []).map((p: any) => {
                              const active = (item.participants || []).includes(p.id);
                              const per =
                                active && (item.participants || []).length > 0
                                  ? (Number(item.price || 0) / Math.max(1, (item.participants || []).length)).toLocaleString(
                                      "th-TH",
                                      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                    )
                                  : null;
                              return (
                                <button
                                  key={`${item.id}-${p.id}`}
                                  type="button"
                                  onClick={() => handleParticipantToggle(item.id as string, p.id)}
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                    active ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                  }`}
                                >
                                  {p.name}
                                  {active && <span className="ml-1">({per} บาท)</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>ผู้ร่วมบิล</span>
                {isEditMode && (
                  <Button variant="outline" size="sm" onClick={handleAddParticipant}>
                    + เพิ่มผู้ร่วมบิล
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(bill.participants || []).map((p: any) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between border-b pb-2 ${
                      bill.splitMethod === "itemized" && unassignedParticipants.includes(p.id)
                        ? "bg-yellow-50 rounded p-2 -mx-2"
                        : ""
                    }`}
                  >
                    {!isEditMode ? (
                      <>
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-sm text-gray-500">{formatCurrency(participantShares[p.id] || 0)} บาท</p>
                        </div>
                        <div>
                          <Button
                            size="sm"
                            variant={p.status === "paid" ? "outline" : "primary"}
                            className={`text-xs ${p.status === "paid" ? "border-green-500 text-green-600" : ""}`}
                            onClick={() => updatePaymentStatus(p.id, p.status === "paid" ? "pending" : "paid")}
                            disabled={isSaving}
                          >
                            {p.status === "paid" ? (
                              <span className="flex items-center">
                                <CheckCircle2 size={14} className="mr-1" /> ชำระแล้ว
                              </span>
                            ) : (
                              "ชำระเงิน"
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 pr-3">
                          <input
                            type="text"
                            value={p.name || ""}
                            onChange={(e) => handleUpdateParticipantName(p.id, e.target.value)}
                            className="border rounded px-3 py-2 w-full"
                            placeholder="ชื่อผู้ร่วมบิล"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            จะคำนวณยอดชำระอัตโนมัติ: {formatCurrency(participantShares[p.id] || 0)} บาท
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                        <Button variant="danger" size="sm" onClick={() => handleRemoveParticipant(p.id)}>
                            ลบ
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รายละเอียดค่าใช้จ่าย</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">ยอดรวมค่าอาหาร</span>
                  <span className="font-medium">{formatTHB(totals.food)} บาท</span>
                </div>
                {bill.vat > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">VAT ({bill.vat}%)</span>
                    <span className="font-medium">{formatTHB(totals.vatAmt)} บาท</span>
                  </div>
                )}
                {bill.serviceCharge > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ค่าบริการ ({bill.serviceCharge}%)</span>
                    <span className="font-medium">{formatTHB(totals.svcAmt)} บาท</span>
                  </div>
                )}
                {bill.discount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ส่วนลด</span>
                    <span className="font-medium text-green-600">- {formatTHB(totals.discount)} บาท</span>
                  </div>
                )}
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center font-bold">
                    <span>ยอดรวมทั้งสิ้น</span>
                    <span className="text-lg text-primary">{formatTHB(totals.grand)} บาท</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR พร้อมเพย์ของแต่ละคน (เฉพาะบิลที่บันทึกเลขพร้อมเพย์ไว้) */}
          {!isEditMode && sanitizePromptPayId(bill.promptPayId) && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>ให้เพื่อนสแกนจ่าย</CardTitle>
              </CardHeader>
              <CardContent>
                <PerPersonPromptPayQR
                  promptPayId={bill.promptPayId as string}
                  people={(bill.participants || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    amount: participantShares[p.id] || 0,
                    paid: p.status === "paid",
                  }))}
                />
                <p className="mt-3 text-center text-xs text-gray-500">พร้อมเพย์ {bill.promptPayId}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {isEditMode && isEdited && (
        <div className="sticky bottom-4 left-0 right-0 z-10 flex justify-center">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur px-4 py-2 rounded-2xl shadow-lg border flex items-center gap-3">
            <span className="text-sm">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
            <Button variant="primary" onClick={handleSaveChanges} disabled={isSaving}>
              <Save size={16} className="mr-1" />
              {isSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </Button>
          </div>
        </div>
      )}

      <div className="text-center mt-6">
        <Button variant="outline" className="mr-2" onClick={() => router.push("/bill-history")}>
          กลับไปหน้าประวัติบิล
        </Button>
      </div>
    </div>
  );
}

/**
 * Page wrapper
 */
export default function BillDetailPage() {
  return (
    <FirebaseProvider>
      <BillDetailContent />
    </FirebaseProvider>
  );
}
