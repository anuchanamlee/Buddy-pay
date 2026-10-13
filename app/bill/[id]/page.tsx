"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Bill, FoodItem } from "../../lib/schema";
import { calculateSplit } from "../../lib/billCalculator";
import { PerPersonPromptPayQR, sanitizePromptPayId } from "../../components/PromptPayQR";
import { formatTHB, formatThaiDate } from "../../lib/format";
import { useParams, useRouter } from "next/navigation";
import { FirebaseProvider, useFirebase } from "../../components/providers/FirebaseWrapper";
import { useAuthModal } from "../../context/AuthModalContext";
import { Button } from "@/app/components/ui/Button";
import { ReceiptSlip } from "@/app/components/ui/ReceiptSlip";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, Clock, Pencil, Save, AlertTriangle } from "lucide-react";
import { CategoryIcon } from "../../components/CategorySelect";

type BillWithId = Bill & { id: string; splitResults?: any[]; promptPayId?: string };

const fieldClass =
  "h-11 w-full rounded-[10px] border border-input bg-card px-3 text-base text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";

function StateScreen({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <Button className="mt-6" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

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
      <div className="mx-auto max-w-2xl px-4 py-16 text-center" role="status" aria-live="polite">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden />
        <p className="mt-4 text-muted-foreground">กำลังโหลดบิล</p>
      </div>
    );
  }

  if (!user) {
    return (
      <StateScreen
        title="เข้าสู่ระบบเพื่อดูบิลนี้"
        message="บิลที่บันทึกไว้เปิดดูได้เฉพาะเจ้าของบิล เข้าสู่ระบบแล้วกลับมาที่หน้านี้อีกครั้ง"
        actionLabel="เข้าสู่ระบบ"
        onAction={openLoginModal}
      />
    );
  }

  if (unauthorized) {
    return (
      <StateScreen
        title="ไม่มีสิทธิ์เปิดบิลนี้"
        message="บิลนี้เป็นของบัญชีอื่น ถ้าเป็นบิลของคุณ ลองเข้าสู่ระบบด้วยบัญชีที่สร้างบิล"
        actionLabel="กลับไปประวัติบิล"
        onAction={() => router.push("/bill-history")}
      />
    );
  }

  if (error || !bill) {
    const notFound = !error || error.startsWith("ไม่พบ");
    return (
      <StateScreen
        title={notFound ? "ไม่พบบิลนี้" : "เปิดบิลไม่ได้"}
        message={
          notFound
            ? "บิลอาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง เลือกบิลจากประวัติแทน"
            : "โหลดข้อมูลไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง"
        }
        actionLabel={notFound ? "กลับไปประวัติบิล" : "ลองอีกครั้ง"}
        onAction={notFound ? () => router.push("/bill-history") : fetchBillDetail}
      />
    );
  }

  const participants: any[] = bill.participants || [];
  const foodItems: any[] = bill.foodItems || [];
  const itemCount = (pid: string) => foodItems.filter((i) => (i.participants || []).includes(pid)).length;
  const allPaid = participants.length > 0 && participants.every((p) => p.status === "paid");
  const showPromptPay = !!sanitizePromptPayId(bill.promptPayId);

  const saveBanner = saveMessage && (
    <div
      role={saveMessage.type === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        saveMessage.type === "success"
          ? "border-success-500 bg-success-50 text-success-700"
          : "border-destructive bg-card text-destructive"
      )}
    >
      {saveMessage.text}
    </div>
  );

  /**
   * VIEW MODE
   */
  if (!isEditMode) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => router.push("/bill-history")}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          ประวัติบิล
        </Button>

        <header>
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 break-words text-2xl font-bold text-foreground">{bill.name}</h1>
            {bill.categoryId && (
              <span className="flex shrink-0 items-center rounded-full bg-muted px-3 py-1" aria-hidden>
                <CategoryIcon categoryId={bill.categoryId} size={20} />
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatThaiDate(bill.createdAt as any, { withTime: false })}, {participants.length} คน, รวม{" "}
            <span className="font-semibold tabular-nums text-foreground">{formatTHB(totals.grand)} บาท</span>
          </p>
        </header>

        {saveBanner}

        <section aria-labelledby="shares-heading">
          <h2 id="shares-heading" className="text-lg font-semibold text-foreground">
            ยอดที่แต่ละคนต้องจ่าย
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {participants.map((p) => {
              const paid = p.status === "paid";
              const count = itemCount(p.id);
              return (
                <ReceiptSlip
                  key={p.id}
                  name={p.name}
                  amount={participantShares[p.id] || 0}
                  detail={
                    bill.splitMethod === "equal"
                      ? "หารเท่ากัน"
                      : count > 0
                      ? `${count} รายการ`
                      : "ไม่ได้กินรายการไหน"
                  }
                  status={paid ? "paid" : "pending"}
                >
                  <button
                    type="button"
                    onClick={() => updatePaymentStatus(p.id, paid ? "pending" : "paid")}
                    disabled={isSaving}
                    aria-label={paid ? `${p.name} จ่ายแล้ว แตะเพื่อยกเลิก` : `${p.name} ยังไม่จ่าย แตะเมื่อได้รับเงินแล้ว`}
                    className={cn(
                      "mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-60",
                      paid
                        ? "bg-success-50 text-success-700 hover:bg-success-50/70"
                        : "bg-warning-50 text-warning-700 hover:bg-warning-50/70"
                    )}
                  >
                    {paid ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Clock className="h-5 w-5" aria-hidden />}
                    {paid ? "จ่ายแล้ว (แตะเพื่อยกเลิก)" : "ยังไม่จ่าย แตะเมื่อได้รับเงิน"}
                  </button>
                  <div className="h-3" />
                </ReceiptSlip>
              );
            })}
          </div>
        </section>

        {showPromptPay && (
          <section aria-labelledby="pay-heading">
            <h2 id="pay-heading" className="text-lg font-semibold text-foreground">
              ให้เพื่อนสแกนจ่าย
            </h2>
            <div className="mt-3 max-w-sm rounded-xl border border-border bg-card p-4">
              <PerPersonPromptPayQR
                promptPayId={bill.promptPayId as string}
                people={participants.map((p) => ({
                  id: p.id,
                  name: p.name,
                  amount: participantShares[p.id] || 0,
                  paid: p.status === "paid",
                }))}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                โอนเข้าพร้อมเพย์ {sanitizePromptPayId(bill.promptPayId)} ตรวจชื่อผู้รับในแอปธนาคารก่อนกดยืนยัน
              </p>
            </div>
          </section>
        )}

        <section aria-labelledby="breakdown-heading">
          <h2 id="breakdown-heading" className="text-lg font-semibold text-foreground">
            ค่าใช้จ่ายทั้งบิล
          </h2>
          <dl className="mt-3 space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">ค่าอาหาร</dt>
              <dd className="tabular-nums text-foreground">{formatTHB(totals.food)} บาท</dd>
            </div>
            {bill.vat > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">VAT {bill.vat}%</dt>
                <dd className="tabular-nums text-foreground">{formatTHB(totals.vatAmt)} บาท</dd>
              </div>
            )}
            {bill.serviceCharge > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">ค่าบริการ {bill.serviceCharge}%</dt>
                <dd className="tabular-nums text-foreground">{formatTHB(totals.svcAmt)} บาท</dd>
              </div>
            )}
            {bill.discount > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">ส่วนลด</dt>
                <dd className="tabular-nums text-foreground">-{formatTHB(totals.discount)} บาท</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-bold">
              <dt className="text-foreground">ยอดรวม</dt>
              <dd className="tabular-nums text-foreground">{formatTHB(totals.grand)} บาท</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col gap-2 border-t border-border pt-6 sm:flex-row">
          <Button
            variant={allPaid ? "outline" : "primary"}
            onClick={() => updateAllPaymentStatus(allPaid ? "pending" : "paid")}
            isLoading={isSaving}
            loadingText="กำลังบันทึก"
            className="sm:flex-1"
          >
            {allPaid ? <Clock className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            {allPaid ? "ยกเลิกจ่ายครบทุกคน" : "จ่ายครบทุกคน"}
          </Button>
          <Button variant="secondary" onClick={handleToggleEditMode} className="sm:flex-1">
            <Pencil className="h-4 w-4" aria-hidden />
            แก้ไขบิล
          </Button>
        </div>
      </div>
    );
  }

  /**
   * EDIT MODE (logic เดิม ปรับสไตล์เป็น token)
   */
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 pb-28">
      <Button variant="ghost" size="sm" className="-ml-3" onClick={handleToggleEditMode}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        ยกเลิกแก้ไข
      </Button>

      <header>
        <h1 className="break-words text-2xl font-bold text-foreground">แก้ไขบิล {bill.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          วิธีหาร: {bill.splitMethod === "equal" ? "หารเท่ากันหมด" : "หารตามรายการที่สั่ง"}
        </p>
      </header>

      {saveBanner}

      {bill.splitMethod === "itemized" && unassignedParticipants.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-xl border border-warning-400 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">คำเตือน:</span> มีผู้เข้าร่วมบางคนยังไม่ได้เลือกรายการอาหาร กรุณาเลือกว่าใครกินอะไรบ้าง
          </p>
        </div>
      )}

      <section aria-labelledby="items-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="items-heading" className="text-lg font-semibold text-foreground">รายการอาหาร</h2>
          <Button variant="outline" size="sm" onClick={handleAddFoodItem}>
            + เพิ่มเมนูอาหาร
          </Button>
        </div>
        {foodItems.map((item: any) => (
          <div key={item.id} className="space-y-3 rounded-xl border border-border bg-card p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
              <input
                type="text"
                value={item.name || ""}
                onChange={(e) => handleUpdateFoodItem(item.id, "name" as any, e.target.value)}
                className={fieldClass}
                placeholder="ชื่อเมนู"
                aria-label="ชื่อเมนู"
              />
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={item.price ?? 0}
                onChange={(e) => handleUpdateFoodItem(item.id, "price" as any, e.target.value)}
                className={cn(fieldClass, "tabular-nums")}
                placeholder="ราคา"
                aria-label="ราคา (บาท)"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {bill.splitMethod === "itemized" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleToggleAllParticipantsForItem(item.id, "all")}>
                    เลือกทุกคน
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggleAllParticipantsForItem(item.id, "none")}>
                    ล้าง
                  </Button>
                </>
              )}
              <Button variant="danger" size="sm" className="ml-auto" onClick={() => handleDeleteFoodItem(item.id)}>
                ลบเมนูนี้
              </Button>
            </div>
            {bill.splitMethod === "itemized" && (
              <div className="flex flex-wrap gap-2">
                {participants.map((p: any) => {
                  const active = (item.participants || []).includes(p.id);
                  const per =
                    active && (item.participants || []).length > 0
                      ? formatTHB(Number(item.price || 0) / Math.max(1, (item.participants || []).length))
                      : null;
                  return (
                    <button
                      key={`${item.id}-${p.id}`}
                      type="button"
                      onClick={() => handleParticipantToggle(item.id as string, p.id)}
                      aria-pressed={active}
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-accent"
                      )}
                    >
                      {p.name}
                      {active && <span className="ml-1 tabular-nums">({per} บาท)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </section>

      <section aria-labelledby="people-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="people-heading" className="text-lg font-semibold text-foreground">ผู้ร่วมบิล</h2>
          <Button variant="outline" size="sm" onClick={handleAddParticipant}>
            + เพิ่มผู้ร่วมบิล
          </Button>
        </div>
        {participants.map((p: any) => (
          <div
            key={p.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-card p-3",
              bill.splitMethod === "itemized" && unassignedParticipants.includes(p.id)
                ? "border-warning-400 bg-warning-50"
                : "border-border"
            )}
          >
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={p.name || ""}
                onChange={(e) => handleUpdateParticipantName(p.id, e.target.value)}
                className={fieldClass}
                placeholder="ชื่อผู้ร่วมบิล"
                aria-label="ชื่อผู้ร่วมบิล"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                จะคำนวณยอดชำระอัตโนมัติ: <span className="tabular-nums">{formatTHB(participantShares[p.id] || 0)}</span> บาท
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleRemoveParticipant(p.id)} aria-label={`ลบ ${p.name || "ผู้ร่วมบิล"}`}>
              ลบ
            </Button>
          </div>
        ))}
      </section>

      {isEdited && (
        <div className="fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-2 shadow-lg">
            <span className="text-sm text-foreground">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
            <Button variant="primary" onClick={handleSaveChanges} isLoading={isSaving} loadingText="กำลังบันทึก">
              <Save className="h-4 w-4" aria-hidden />
              บันทึกการแก้ไข
            </Button>
          </div>
        </div>
      )}
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
