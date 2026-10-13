'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/lib/utils';
import { formatTHB } from '@/app/lib/format';
import {
  addItem,
  addPerson,
  isEveryone,
  removeItem,
  removePerson,
  setEveryone,
  toggleEater,
  updateItem,
  type BillDraft,
} from '@/app/lib/billDraft';

export interface BillExtras {
  vat: number;
  serviceCharge: number;
  discount: number;
}

interface SavedGroup {
  id: string;
  name: string;
  participants: { name: string }[];
}

interface BillEditorProps {
  draft: BillDraft;
  onDraftChange: (draft: BillDraft) => void;
  extras: BillExtras;
  onExtrasChange: (extras: BillExtras) => void;
  savedGroups?: SavedGroup[];
  onSaveGroup?: (name: string) => void;
}

/** แปลงข้อความราคาเป็นตัวเลข รับ "1,250" และ "80.5" ได้ */
export function parsePrice(text: string): number {
  const n = Number.parseFloat(text.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : Number.NaN;
}

const fieldClass =
  'h-11 w-full rounded-[10px] border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground/80 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30';

/**
 * หน้า "ใส่บิล" หน้าเดียว: ใครไปบ้าง + กินอะไร
 * พิมพ์แล้วกด Enter ได้ตลอด ไม่มีปุ่มเปิด/ปิดฟอร์ม ทุกรายการเริ่มที่ทุกคนกิน
 */
export function BillEditor({ draft, onDraftChange, extras, onExtrasChange, savedGroups = [], onSaveGroup }: BillEditorProps) {
  const [nameInput, setNameInput] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const itemNameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  // วางชื่อหลายคนพร้อมกันได้ คั่นด้วยจุลภาคหรือขึ้นบรรทัดใหม่
  const commitNames = (text: string) => {
    const names = text.split(/[,\n]/).map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    onDraftChange(names.reduce((d, n) => addPerson(d, n), draft));
    setNameInput('');
  };

  const commitItem = () => {
    if (!itemPrice.trim() && !itemName.trim()) return;
    const price = parsePrice(itemPrice);
    if (!(price > 0)) {
      setPriceError('ใส่ราคาเป็นตัวเลขที่มากกว่า 0');
      priceRef.current?.focus();
      return;
    }
    onDraftChange(addItem(draft, itemName, price));
    setItemName('');
    setItemPrice('');
    setPriceError(null);
    itemNameRef.current?.focus();
  };

  const applyGroup = (group: SavedGroup) => {
    const base: BillDraft = { participants: [], foodItems: draft.foodItems.map((i) => ({ ...i, participants: [] })) };
    let next = group.participants.reduce((d, p) => addPerson(d, p.name), base);
    // รายการที่มีอยู่แล้วให้ทุกคนในกลุ่มกิน
    next = { ...next, foodItems: next.foodItems.map((i) => ({ ...i, participants: next.participants.map((p) => p.id) })) };
    onDraftChange(next);
  };

  const people = draft.participants;
  const extrasCount = [extras.vat, extras.serviceCharge, extras.discount].filter((v) => v > 0).length;

  return (
    <div className="space-y-8">
      {/* ใครไปบ้าง */}
      <section aria-labelledby="people-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="people-heading" className="text-lg font-semibold text-foreground">
            ใครไปบ้าง
          </h2>
          {people.length > 0 && <span className="text-sm text-muted-foreground tabular-nums">{people.length} คน</span>}
        </div>

        {savedGroups.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">กลุ่มที่บันทึกไว้:</span>
            {savedGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => applyGroup(g)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-jade-200 bg-jade-50 px-3 text-sm font-medium text-jade-800 hover:bg-jade-100"
              >
                <Users className="h-4 w-4" aria-hidden />
                {g.name}
              </button>
            ))}
          </div>
        )}

        {people.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="รายชื่อคนที่ไป">
            {people.map((p) => (
              <li key={p.id} className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-muted pl-3 pr-1 text-sm font-medium text-foreground">
                {p.name}
                <button
                  type="button"
                  onClick={() => onDraftChange(removePerson(draft, p.id))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                  aria-label={`เอา ${p.name} ออก`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            commitNames(nameInput);
          }}
        >
          <label htmlFor="person-name" className="sr-only">ชื่อเพื่อน</label>
          <input
            id="person-name"
            ref={nameRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (/[,\n]/.test(text)) {
                e.preventDefault();
                commitNames(text);
              }
            }}
            onKeyDown={(e) => {
              // ใส่ชื่อครบแล้วกด Enter ที่ช่องว่าง = ไปใส่รายการต่อ ไม่ต้องแตะหน้าจอ
              if (e.key === 'Enter' && !nameInput.trim() && people.length >= 2) {
                e.preventDefault();
                itemNameRef.current?.focus();
              }
            }}
            autoFocus={people.length === 0}
            placeholder={people.length === 0 ? 'พิมพ์ชื่อแล้วกด Enter เช่น มิ้นท์' : 'เพิ่มอีกคน'}
            enterKeyHint="enter"
            autoComplete="off"
            className={fieldClass}
          />
          <Button type="submit" variant="secondary" className="shrink-0" disabled={!nameInput.trim()} aria-label="เพิ่มชื่อ">
            <Plus className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">เพิ่ม</span>
          </Button>
        </form>

        {people.length >= 2 && (
          <p className="mt-2 text-sm text-muted-foreground">ครบแล้วกด Enter ที่ช่องว่างเพื่อไปใส่รายการ</p>
        )}

        {onSaveGroup && people.length >= 2 && (
          <button
            type="button"
            className="mt-2 text-sm font-medium text-primary hover:underline"
            onClick={() => {
              const name = window.prompt('ตั้งชื่อกลุ่ม เช่น เพื่อนที่ทำงาน');
              if (name && name.trim()) onSaveGroup(name.trim());
            }}
          >
            บันทึกรายชื่อนี้เป็นกลุ่ม
          </button>
        )}
      </section>

      {/* กินอะไรบ้าง */}
      <section aria-labelledby="items-heading">
        <h2 id="items-heading" className="text-lg font-semibold text-foreground">
          กินอะไรบ้าง
        </h2>
        {people.length >= 2 && draft.foodItems.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">ทุกรายการหารทุกคนให้ก่อน ใครไม่ได้กิน แตะ &quot;แยกคนกิน&quot; แล้วเอาชื่อออก</p>
        )}

        {draft.foodItems.length > 0 && (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {draft.foodItems.map((item) => {
              const everyone = isEveryone(item, people);
              const open = openItem === item.id;
              return (
                <li key={item.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`name-${item.id}`}>ชื่อรายการ</label>
                    <input
                      id={`name-${item.id}`}
                      defaultValue={item.name}
                      onBlur={(e) => onDraftChange(updateItem(draft, item.id, { name: e.target.value }))}
                      className="h-10 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-base text-foreground hover:border-border focus:border-ring focus:outline-none"
                    />
                    <label className="sr-only" htmlFor={`price-${item.id}`}>ราคา {item.name}</label>
                    <input
                      id={`price-${item.id}`}
                      defaultValue={String(item.price)}
                      inputMode="decimal"
                      onBlur={(e) => {
                        const price = parsePrice(e.target.value);
                        if (price > 0) onDraftChange(updateItem(draft, item.id, { price }));
                        else e.target.value = String(item.price);
                      }}
                      className="h-10 w-24 rounded-md border border-transparent bg-transparent px-2 text-right text-base tabular-nums text-foreground hover:border-border focus:border-ring focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onDraftChange(removeItem(draft, item.id))}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`ลบ ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  {people.length >= 2 && (
                    <div className="mt-1 pl-2">
                      <button
                        type="button"
                        onClick={() => setOpenItem(open ? null : item.id)}
                        aria-expanded={open}
                        className="inline-flex min-h-[32px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        {everyone ? 'ทุกคนกิน' : `${item.participants.length} คนกิน: ${people.filter((p) => item.participants.includes(p.id)).map((p) => p.name).join(', ')}`}
                        <span className="font-medium text-primary">· แยกคนกิน</span>
                        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
                      </button>
                      {open && (
                        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`คนที่กิน ${item.name}`}>
                          {people.map((p) => {
                            const on = item.participants.includes(p.id);
                            const last = on && item.participants.length === 1;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                aria-pressed={on}
                                disabled={last}
                                title={last ? 'ต้องมีคนกินอย่างน้อย 1 คน' : undefined}
                                onClick={() => onDraftChange(toggleEater(draft, item.id, p.id))}
                                className={cn(
                                  'min-h-[36px] rounded-full border px-3 text-sm font-medium transition-colors',
                                  on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-muted-foreground line-through',
                                  last && 'cursor-not-allowed opacity-80',
                                )}
                              >
                                {p.name}
                              </button>
                            );
                          })}
                          {!everyone && (
                            <button
                              type="button"
                              onClick={() => onDraftChange(setEveryone(draft, item.id))}
                              className="min-h-[36px] px-2 text-sm font-medium text-primary hover:underline"
                            >
                              ทุกคนกิน
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="mt-3 grid grid-cols-[1fr_7.5rem_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            commitItem();
          }}
        >
          <label htmlFor="item-name" className="sr-only">ชื่อรายการ</label>
          <input
            id="item-name"
            ref={itemNameRef}
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !itemPrice.trim()) {
                e.preventDefault();
                priceRef.current?.focus();
              }
            }}
            placeholder={draft.foodItems.length === 0 ? 'เมนู เช่น หมูกระทะ' : 'เมนูถัดไป'}
            enterKeyHint="next"
            autoComplete="off"
            className={fieldClass}
          />
          <label htmlFor="item-price" className="sr-only">ราคา (บาท)</label>
          <input
            id="item-price"
            ref={priceRef}
            value={itemPrice}
            onChange={(e) => {
              setItemPrice(e.target.value);
              setPriceError(null);
            }}
            placeholder="ราคา"
            inputMode="decimal"
            enterKeyHint="enter"
            autoComplete="off"
            aria-invalid={!!priceError}
            aria-describedby={priceError ? 'item-price-error' : undefined}
            className={cn(fieldClass, 'text-right tabular-nums', priceError && 'border-destructive')}
          />
          <Button type="submit" variant="secondary" aria-label="เพิ่มรายการ" disabled={!itemPrice.trim()}>
            <Plus className="h-5 w-5" aria-hidden />
          </Button>
          {priceError && (
            <p id="item-price-error" role="alert" className="col-span-3 text-sm text-destructive">
              {priceError}
            </p>
          )}
        </form>
      </section>

      {/* VAT ค่าบริการ ส่วนลด: พับไว้ เพราะร้านส่วนใหญ่รวมในราคาแล้ว */}
      <details className="group rounded-xl border border-border bg-card" open={extrasCount > 0}>
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-foreground">
          <span>
            VAT ค่าบริการ ส่วนลด
            {extrasCount > 0 && <span className="ml-2 text-muted-foreground">(ใส่แล้ว {extrasCount} อย่าง)</span>}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid grid-cols-3 gap-3 px-4 pb-4">
          {(
            [
              { key: 'vat', label: 'VAT (%)', max: 100 },
              { key: 'serviceCharge', label: 'ค่าบริการ (%)', max: 100 },
              { key: 'discount', label: 'ส่วนลด (บาท)', max: 1_000_000 },
            ] as const
          ).map((f) => (
            <label key={f.key} className="text-sm text-muted-foreground">
              {f.label}
              <input
                inputMode="decimal"
                defaultValue={extras[f.key] ? String(extras[f.key]) : ''}
                placeholder="0"
                onBlur={(e) => {
                  const v = parsePrice(e.target.value || '0');
                  const value = Number.isFinite(v) ? Math.min(Math.max(v, 0), f.max) : 0;
                  e.target.value = value ? String(value) : '';
                  onExtrasChange({ ...extras, [f.key]: value });
                }}
                className={cn(fieldClass, 'mt-1 text-right tabular-nums')}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

/** แถบล่างจอ: ยอดรวมกับปุ่มไปหน้าผลลัพธ์ */
export function BillFooter({ total, missing, onSubmit }: { total: number; missing: string | null; onSubmit: () => void }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">ยอดรวม</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{formatTHB(total)} บาท</p>
        </div>
        <Button size="lg" onClick={onSubmit} disabled={!!missing} className="shrink-0">
          ดูยอดของแต่ละคน
        </Button>
      </div>
      {missing && (
        <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
          {missing}
        </p>
      )}
    </div>
  );
}
