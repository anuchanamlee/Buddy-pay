'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, Save, Send } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { ReceiptSlip } from '@/app/components/ui/ReceiptSlip';
import { PerPersonPromptPayQR, sanitizePromptPayId } from '@/app/components/PromptPayQR';
import { formatThaiDate, formatTHB } from '@/app/lib/format';
import { personBreakdown } from '@/app/lib/breakdown';
import { createShareLink, lineShareUrl } from '@/app/lib/share/client';
import type { SplitResult } from '@/app/lib/billCalculator';
import type { FoodItem, Participant } from '@/app/lib/schema';
import type { BillExtras } from './BillEditor';

interface BillResultProps {
  /** create = เพิ่งหารเสร็จ แก้ชื่อ/พร้อมเพย์ได้ / shared = เพื่อนเปิดจากลิงก์ */
  mode: 'create' | 'shared';
  billName: string;
  onBillNameChange?: (name: string) => void;
  date?: Date;
  participants: Participant[];
  foodItems: FoodItem[];
  results: SplitResult[];
  extras: BillExtras;
  total: number;
  categoryId?: string;
  promptPayId: string;
  onPromptPayChange?: (value: string) => void;
  notes?: string;
  onEdit?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  /** shared mode: ลิงก์ของหน้านี้ */
  shareUrl?: string;
}

export function BillResult({
  mode,
  billName,
  onBillNameChange,
  date = new Date(),
  participants,
  foodItems,
  results,
  extras,
  total,
  categoryId,
  promptPayId,
  onPromptPayChange,
  notes,
  onEdit,
  onSave,
  isSaving,
  shareUrl: existingShareUrl,
}: BillResultProps) {
  const [shareUrl, setShareUrl] = useState(existingShareUrl || '');
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const promptPayValid = !!sanitizePromptPayId(promptPayId);

  // ข้อมูลบิลเปลี่ยน ลิงก์เดิมไม่ตรงแล้ว ต้องสร้างใหม่ตอนกดส่ง
  const fingerprint = useMemo(
    () => JSON.stringify([billName, promptPayId, results.map((r) => [r.participant.name, r.amount])]),
    [billName, promptPayId, results],
  );
  useEffect(() => {
    if (mode === 'create') setShareUrl('');
  }, [fingerprint, mode]);

  const ensureShareUrl = async (): Promise<string> => {
    if (shareUrl) return shareUrl;
    const url = await createShareLink({
      billName: billName.trim() || 'บิล',
      totalAmount: total,
      vat: extras.vat,
      discount: extras.discount,
      serviceCharge: extras.serviceCharge,
      splitMethod: 'itemized',
      categoryId,
      participants,
      foodItems,
      splitResults: results,
      promptPayId: promptPayValid ? sanitizePromptPayId(promptPayId)! : undefined,
      notes,
    });
    setShareUrl(url);
    return url;
  };

  // ส่งเข้า LINE กดครั้งเดียว: เปิดแท็บไว้ก่อน (กันเบราว์เซอร์บล็อก popup) แล้วค่อยใส่ลิงก์เมื่อสร้างเสร็จ
  const handleSendLine = async () => {
    setShareError(null);
    if (shareUrl) {
      window.open(lineShareUrl(billName, shareUrl), '_blank', 'noopener');
      return;
    }
    const tab = window.open('', '_blank');
    setSharing(true);
    try {
      const url = await ensureShareUrl();
      const target = lineShareUrl(billName, url);
      if (tab) tab.location.href = target;
      else window.location.href = target;
    } catch (err) {
      tab?.close();
      setShareError(err instanceof Error ? err.message : 'สร้างลิงก์ไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    setShareError(null);
    setSharing(true);
    try {
      const url = await ensureShareUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // คัดลอกไม่ได้ (บางเบราว์เซอร์) ลิงก์ยังแสดงให้กดค้างคัดลอกเองได้
      if (err instanceof Error && !shareUrl) setShareError(err.message);
    } finally {
      setSharing(false);
    }
  };

  const itemCount = (id: string) => foodItems.filter((i) => i.participants.includes(id)).length;

  return (
    <div className="space-y-8">
      {/* หัวบิล: แก้ชื่อได้ตรงนี้ ไม่ต้องมีหน้าแยก */}
      <header>
        {mode === 'create' && onBillNameChange ? (
          <label className="block">
            <span className="sr-only">ชื่อบิล</span>
            <input
              value={billName}
              onChange={(e) => onBillNameChange(e.target.value)}
              onBlur={(e) => !e.target.value.trim() && onBillNameChange('บิล')}
              maxLength={200}
              className="-mx-2 w-[calc(100%+1rem)] rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-bold text-foreground hover:border-border focus:border-ring focus:outline-none"
            />
          </label>
        ) : (
          <h1 className="text-2xl font-bold text-foreground">{billName}</h1>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {formatThaiDate(date, { withTime: false })}, {participants.length} คน, รวม{' '}
          <span className="font-semibold tabular-nums text-foreground">{formatTHB(total)} บาท</span>
        </p>
      </header>

      {/* ยอดของแต่ละคน: จุดเด่นของหน้า */}
      <section aria-labelledby="shares-heading">
        <h2 id="shares-heading" className="text-lg font-semibold text-foreground">
          ยอดที่แต่ละคนต้องจ่าย
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((r) => {
            const open = !!expanded[r.participant.id];
            const b = personBreakdown(r.participant.id, foodItems, extras);
            const count = itemCount(r.participant.id);
            return (
              <ReceiptSlip
                key={r.participant.id}
                name={r.participant.name}
                amount={r.amount}
                detail={count > 0 ? `${count} รายการ` : 'ไม่ได้กินรายการไหน'}
                status={r.participant.status === 'paid' ? 'paid' : undefined}
              >
                {count > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [r.participant.id]: !open }))}
                    aria-expanded={open}
                    className="-mx-1 mt-2 flex w-[calc(100%+0.5rem)] items-center justify-between rounded-md px-1 py-2 text-sm font-medium text-primary hover:bg-accent"
                  >
                    {open ? 'ซ่อนที่มา' : 'ดูว่ามาจากอะไร'}
                    {open ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
                  </button>
                )}
                {open && (
                  <dl className="space-y-1 pb-1 text-sm">
                    {b.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between gap-3">
                        <dt className="min-w-0 truncate text-foreground">
                          {i.name}
                          {i.sharedWith > 1 && <span className="text-muted-foreground"> (หาร {i.sharedWith})</span>}
                        </dt>
                        <dd className="tabular-nums text-foreground">{formatTHB(i.share)}</dd>
                      </div>
                    ))}
                    {b.vat > 0 && (
                      <div className="flex justify-between text-muted-foreground"><dt>VAT {extras.vat}%</dt><dd className="tabular-nums">{formatTHB(b.vat)}</dd></div>
                    )}
                    {b.service > 0 && (
                      <div className="flex justify-between text-muted-foreground"><dt>ค่าบริการ {extras.serviceCharge}%</dt><dd className="tabular-nums">{formatTHB(b.service)}</dd></div>
                    )}
                    {b.discount > 0 && (
                      <div className="flex justify-between text-muted-foreground"><dt>ส่วนลด</dt><dd className="tabular-nums">-{formatTHB(b.discount)}</dd></div>
                    )}
                  </dl>
                )}
              </ReceiptSlip>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">ปัดเป็นสตางค์ให้ยอดทุกคนรวมกันได้ {formatTHB(total)} บาทพอดี</p>
      </section>

      {/* QR พร้อมเพย์ */}
      <section aria-labelledby="pay-heading">
        <h2 id="pay-heading" className="text-lg font-semibold text-foreground">
          ให้เพื่อนสแกนจ่าย
        </h2>
        {mode === 'create' && onPromptPayChange && (
          <label className="mt-3 block text-sm text-muted-foreground">
            พร้อมเพย์ของคนรับเงิน (เบอร์มือถือหรือเลขบัตรประชาชน)
            <input
              value={promptPayId}
              onChange={(e) => onPromptPayChange(e.target.value)}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="08x-xxx-xxxx"
              maxLength={20}
              className="mt-1 h-11 w-full max-w-xs rounded-[10px] border border-input bg-card px-3 text-base tabular-nums text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </label>
        )}
        {promptPayValid ? (
          <div className="mt-3 max-w-sm rounded-xl border border-border bg-card p-4">
            <PerPersonPromptPayQR
              promptPayId={promptPayId}
              people={results.map((r) => ({ id: r.participant.id, name: r.participant.name, amount: r.amount, paid: r.participant.status === 'paid' }))}
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              โอนเข้าพร้อมเพย์ {sanitizePromptPayId(promptPayId)} ตรวจชื่อผู้รับในแอปธนาคารก่อนกดยืนยัน
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === 'create' ? 'ใส่เลขพร้อมเพย์ แล้ว QR ของแต่ละคนจะขึ้นตรงนี้ เลขนี้จำไว้ในเครื่องนี้ ครั้งหน้าไม่ต้องพิมพ์ใหม่' : 'ผู้สร้างบิลไม่ได้ใส่เลขพร้อมเพย์'}
          </p>
        )}
      </section>

      {notes && (
        <section aria-labelledby="notes-heading" className="rounded-xl border border-border bg-card p-4">
          <h2 id="notes-heading" className="font-semibold text-foreground">หมายเหตุ</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{notes}</p>
        </section>
      )}

      {/* ส่งต่อ */}
      <section aria-labelledby="share-heading" className="space-y-3">
        <h2 id="share-heading" className="text-lg font-semibold text-foreground">
          ส่งให้เพื่อน
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={handleSendLine} isLoading={sharing} loadingText="กำลังสร้างลิงก์">
            <Send className="h-5 w-5" aria-hidden />
            ส่งเข้า LINE
          </Button>
          <Button size="lg" variant="outline" onClick={handleCopy} disabled={sharing}>
            {copied ? <Check className="h-5 w-5" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
            {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
          </Button>
        </div>
        {shareUrl && (
          <p className="break-all text-xs text-muted-foreground">
            ลิงก์: <a href={shareUrl} className="text-primary underline">{shareUrl}</a> (ใช้ได้ 24 ชั่วโมง)
          </p>
        )}
        {shareError && (
          <p role="alert" className="text-sm text-destructive">
            {shareError}
          </p>
        )}
      </section>

      {mode === 'create' && (
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {onEdit && (
            <Button variant="ghost" onClick={onEdit}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              แก้ไขบิล
            </Button>
          )}
          {onSave && (
            <Button variant="secondary" onClick={onSave} isLoading={isSaving} loadingText="กำลังบันทึก">
              <Save className="h-4 w-4" aria-hidden />
              บันทึกไว้ติดตามว่าใครจ่ายแล้ว
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
