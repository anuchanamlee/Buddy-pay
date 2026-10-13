'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { billReducer } from '../reducers/billReducer';
import { initialState } from '../lib/billTypes';
import { useBillManagement } from '../hooks/useBillManagement';
import { BillEditor, BillFooter, type BillExtras } from '../components/bill/BillEditor';
import { QuickSplit } from '../components/bill/QuickSplit';
import { BillResult } from '../components/bill/BillResult';
import {
  clearSessionDraft,
  defaultBillName,
  loadSavedPromptPay,
  loadSessionDraft,
  quickDraft,
  savePromptPay,
  saveSessionDraft,
  whatIsMissing,
  type BillDraft,
} from '../lib/billDraft';
import { cn } from '@/lib/utils';

type Mode = 'items' | 'quick';
type View = 'edit' | 'result';

/**
 * หารบิล 2 หน้า: ใส่บิล → ผลลัพธ์
 * (เดิม 5 ขั้น: ผู้ร่วมบิล, รายการ, วิธีหาร, ข้อมูลบิล, ผลลัพธ์)
 */
export default function ShareBillPage() {
  const { isAuthenticated, user } = useAuth();
  const [state, dispatch] = useReducer(billReducer, { ...initialState, splitMethod: 'itemized' });
  const {
    promptPayId,
    setPromptPayId,
    calculatedResults,
    handleSaveBill,
    isLoading,
    savedGroups,
    saveParticipantGroup,
    loadParticipantGroups,
  } = useBillManagement(state, dispatch);

  const [mode, setMode] = useState<Mode>('items');
  const [view, setView] = useState<View>('edit');
  const [pendingSave, setPendingSave] = useState(false);
  const [ready, setReady] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const draft: BillDraft = useMemo(() => ({ participants: state.participants, foodItems: state.foodItems }), [state.participants, state.foodItems]);
  const extras: BillExtras = { vat: state.vat, serviceCharge: state.serviceCharge, discount: state.discount };

  const setDraft = useCallback((next: BillDraft) => {
    dispatch({ type: 'SET_PARTICIPANTS', payload: next.participants });
    dispatch({ type: 'SET_FOOD_ITEMS', payload: next.foodItems });
  }, []);

  const setExtras = useCallback((next: BillExtras) => {
    dispatch({ type: 'SET_VAT', payload: next.vat });
    dispatch({ type: 'SET_SERVICE_CHARGE', payload: next.serviceCharge });
    dispatch({ type: 'SET_DISCOUNT', payload: next.discount });
  }, []);

  // เปิดหน้า: คืนบิลที่ค้างไว้ (เช่นกลับมาจากการล็อกอิน) และเลขพร้อมเพย์ที่เคยใช้
  useEffect(() => {
    const saved = loadSessionDraft();
    if (saved) {
      setDraft(saved);
      setExtras(saved);
      dispatch({ type: 'SET_BILL_NAME', payload: saved.billName || '' });
      setMode(saved.mode);
      setView(saved.view);
      setPendingSave(!!saved.pendingSave);
    }
    const pp = loadSavedPromptPay();
    if (pp) setPromptPayId(pp);
    setReady(true);
    // เรียกครั้งเดียวตอนเปิดหน้า
  }, []);

  // เก็บบิลที่กำลังกรอกทุกครั้งที่เปลี่ยน
  useEffect(() => {
    if (!ready) return;
    saveSessionDraft({ ...draft, ...extras, billName: state.billName, view, mode, pendingSave });
  }, [ready, draft, extras.vat, extras.serviceCharge, extras.discount, state.billName, view, mode, pendingSave]);

  // กลุ่มที่บันทึกไว้ (เฉพาะคนที่ล็อกอิน)
  useEffect(() => {
    if (user && isAuthenticated) loadParticipantGroups();
  }, [user, isAuthenticated, loadParticipantGroups]);

  // ผลลัพธ์ล่าสุดเก็บใน state เพื่อใช้ตอนบันทึก
  useEffect(() => {
    dispatch({ type: 'SET_SPLIT_RESULTS', payload: calculatedResults });
  }, [calculatedResults]);

  const showResult = () => {
    if (!state.billName.trim()) dispatch({ type: 'SET_BILL_NAME', payload: defaultBillName() });
    setView('result');
    topRef.current?.scrollIntoView({ block: 'start' });
  };

  const save = useCallback(async () => {
    if (!isAuthenticated) {
      // ล็อกอินแล้วจะกลับมาหน้านี้และบันทึกต่อให้อัตโนมัติ บิลไม่หาย
      try {
        sessionStorage.setItem('returnUrl', '/share-bill');
      } catch {
        /* ไม่เป็นไร */
      }
      setPendingSave(true);
      await handleSaveBill(); // เปิดหน้าต่างล็อกอิน
      return;
    }
    setPendingSave(false);
    const ok = await handleSaveBill();
    if (ok) clearSessionDraft();
  }, [isAuthenticated, handleSaveBill]);

  // กลับมาจากการล็อกอินพร้อมคำสั่งบันทึกที่ค้างไว้
  useEffect(() => {
    if (ready && isAuthenticated && pendingSave && view === 'result' && calculatedResults.length > 0) {
      save();
    }
  }, [ready, isAuthenticated, pendingSave, view, calculatedResults.length, save]);

  const missing = whatIsMissing(draft);

  return (
    <div className="min-h-screen bg-background pb-8 pt-6">
      <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-24 px-4">
        {view === 'edit' ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-foreground">หารบิล</h1>
              <div role="tablist" aria-label="วิธีใส่บิล" className="inline-flex rounded-full bg-muted p-1">
                {(
                  [
                    { id: 'items', label: 'ใส่รายการ' },
                    { id: 'quick', label: 'หารด่วน' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={mode === t.id}
                    onClick={() => setMode(t.id)}
                    className={cn(
                      'min-h-[36px] rounded-full px-4 text-sm font-semibold transition-colors',
                      mode === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'items' ? (
              <>
                <BillEditor
                  draft={draft}
                  onDraftChange={setDraft}
                  extras={extras}
                  onExtrasChange={setExtras}
                  savedGroups={savedGroups}
                  onSaveGroup={isAuthenticated ? (name) => saveParticipantGroup(name) : undefined}
                />
                <div className="mt-8">
                  <BillFooter total={state.totalAmount} missing={missing} onSubmit={showResult} />
                </div>
              </>
            ) : (
              <QuickSplit
                onSubmit={(total, count) => {
                  setDraft(quickDraft(total, count));
                  setExtras({ vat: 0, serviceCharge: 0, discount: 0 });
                  showResult();
                }}
              />
            )}
          </>
        ) : (
          <BillResult
            mode="create"
            billName={state.billName}
            onBillNameChange={(name) => dispatch({ type: 'SET_BILL_NAME', payload: name })}
            participants={state.participants}
            foodItems={state.foodItems}
            results={calculatedResults}
            extras={extras}
            total={state.totalAmount}
            categoryId={state.categoryId}
            promptPayId={promptPayId}
            onPromptPayChange={(v) => {
              setPromptPayId(v);
              savePromptPay(v);
            }}
            onEdit={() => {
              setView('edit');
              topRef.current?.scrollIntoView({ block: 'start' });
            }}
            onSave={save}
            isSaving={isLoading}
          />
        )}
      </div>

      {state.toast.show && (
        <div
          role="status"
          className={cn(
            'fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium shadow-lg',
            state.toast.type === 'error' ? 'bg-destructive text-white' : 'bg-foreground text-background',
          )}
        >
          {state.toast.message}
        </div>
      )}
    </div>
  );
}
