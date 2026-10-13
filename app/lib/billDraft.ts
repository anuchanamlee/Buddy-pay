// การแก้ไขบิลระหว่างกรอก (หน้า "ใส่บิล") เป็นฟังก์ชันบริสุทธิ์ทั้งหมด ทดสอบได้โดยไม่ต้องมี UI
//
// หลักการ: ไม่ต้องให้ผู้ใช้เลือก "วิธีหาร" ทุกรายการเริ่มที่ "ทุกคนกิน"
// ถ้าใครไม่ได้กินก็กดชื่อออก ผลจึงเท่ากับหารเท่ากันเมื่อไม่ได้แก้อะไร และเท่ากับหารตามรายการเมื่อแก้
import { v4 as uuidv4 } from 'uuid';
import type { FoodItem, Participant } from './schema';

export interface BillDraft {
  participants: Participant[];
  foodItems: FoodItem[];
}

export const MIN_PEOPLE = 2;
/** ต้องตรงกับขีดจำกัดของลิงก์แชร์ใน app/lib/share/schema.ts */
export const MAX_PEOPLE = 50;
export const MAX_NAME_CHARS = 200;

const ids = (people: Participant[]) => people.map((p) => p.id);

/** รายการนี้ทุกคนกินอยู่หรือไม่ (ใช้ตัดสินว่าคนที่เพิ่มทีหลังควรเข้าไปในรายการนี้ด้วย) */
export function isEveryone(item: FoodItem, people: Participant[]): boolean {
  return people.length > 0 && people.every((p) => item.participants.includes(p.id));
}

/** เพิ่มคน: ชื่อว่างหรือซ้ำจะไม่ถูกเพิ่ม และคนใหม่เข้าไปในทุกรายการที่ "ทุกคนกิน" */
export function addPerson(draft: BillDraft, rawName: string, id: string = uuidv4()): BillDraft {
  const name = rawName.trim().slice(0, MAX_NAME_CHARS);
  if (!name) return draft;
  if (draft.participants.length >= MAX_PEOPLE) return draft;
  if (draft.participants.some((p) => p.name === name)) return draft;
  const person: Participant = { id, name, status: 'pending' };
  return {
    participants: [...draft.participants, person],
    // รายการที่ยังไม่มีคนกิน (เช่นใส่รายการก่อนใส่ชื่อ) ก็นับเป็น "ทุกคนกิน" ด้วย ไม่อย่างนั้นราคาจะหายจากบิล
    foodItems: draft.foodItems.map((item) =>
      item.participants.length === 0 || isEveryone(item, draft.participants)
        ? { ...item, participants: [...item.participants, id] }
        : item,
    ),
  };
}

/** ลบคน: เอาออกจากทุกรายการด้วย รายการที่ไม่เหลือคนกินจะกลับเป็น "ทุกคนกิน" เพื่อไม่ให้ยอดหาย */
export function removePerson(draft: BillDraft, personId: string): BillDraft {
  const participants = draft.participants.filter((p) => p.id !== personId);
  return {
    participants,
    foodItems: draft.foodItems.map((item) => {
      const eaters = item.participants.filter((pid) => pid !== personId);
      return { ...item, participants: eaters.length > 0 ? eaters : ids(participants) };
    }),
  };
}

export function renamePerson(draft: BillDraft, personId: string, rawName: string): BillDraft {
  const name = rawName.trim();
  if (!name) return draft;
  return { ...draft, participants: draft.participants.map((p) => (p.id === personId ? { ...p, name } : p)) };
}

/** เพิ่มรายการ: ทุกคนกินเป็นค่าเริ่มต้น ไม่ใส่ชื่อก็ได้ (ตั้งเป็น "รายการ n") ราคาต้องมากกว่า 0 */
export function addItem(draft: BillDraft, rawName: string, price: number, id: string = uuidv4()): BillDraft {
  if (!Number.isFinite(price) || price <= 0) return draft;
  const name = (rawName.trim() || `รายการ ${draft.foodItems.length + 1}`).slice(0, MAX_NAME_CHARS);
  const item: FoodItem = { id, name, price: Math.round(price * 100) / 100, participants: ids(draft.participants) };
  return { ...draft, foodItems: [...draft.foodItems, item] };
}

export function updateItem(draft: BillDraft, itemId: string, patch: { name?: string; price?: number }): BillDraft {
  return {
    ...draft,
    foodItems: draft.foodItems.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...item };
      if (patch.name !== undefined && patch.name.trim()) next.name = patch.name.trim().slice(0, MAX_NAME_CHARS);
      if (patch.price !== undefined && Number.isFinite(patch.price) && patch.price > 0) {
        next.price = Math.round(patch.price * 100) / 100;
      }
      return next;
    }),
  };
}

export function removeItem(draft: BillDraft, itemId: string): BillDraft {
  return { ...draft, foodItems: draft.foodItems.filter((i) => i.id !== itemId) };
}

/** กดชื่อใต้รายการเพื่อเอาออก/ใส่กลับ ต้องเหลือคนกินอย่างน้อย 1 คนเสมอ */
export function toggleEater(draft: BillDraft, itemId: string, personId: string): BillDraft {
  return {
    ...draft,
    foodItems: draft.foodItems.map((item) => {
      if (item.id !== itemId) return item;
      const has = item.participants.includes(personId);
      if (has && item.participants.length === 1) return item;
      const participants = has
        ? item.participants.filter((pid) => pid !== personId)
        : draft.participants.map((p) => p.id).filter((pid) => pid === personId || item.participants.includes(pid));
      return { ...item, participants };
    }),
  };
}

export function setEveryone(draft: BillDraft, itemId: string): BillDraft {
  return {
    ...draft,
    foodItems: draft.foodItems.map((item) => (item.id === itemId ? { ...item, participants: ids(draft.participants) } : item)),
  };
}

/** ข้อความบอกว่ายังขาดอะไร (null = คำนวณได้แล้ว) */
export function whatIsMissing(draft: BillDraft): string | null {
  if (draft.participants.length < MIN_PEOPLE) {
    const need = MIN_PEOPLE - draft.participants.length;
    return `ใส่ชื่อเพื่อนอีก ${need} คน`;
  }
  if (draft.foodItems.length === 0) return 'ใส่รายการอย่างน้อย 1 รายการ';
  // กันพลาด: ทุกรายการต้องมีคนกินที่ยังอยู่ในบิลอย่างน้อย 1 คน
  const ids = new Set(draft.participants.map((p) => p.id));
  const orphan = draft.foodItems.find((i) => !i.participants.some((pid) => ids.has(pid)));
  if (orphan) return `เลือกคนกิน "${orphan.name}" อย่างน้อย 1 คน`;
  return null;
}

/** หารด่วน: รู้แค่ยอดรวมกับจำนวนคน */
export function quickDraft(total: number, count: number, names: string[] = []): BillDraft {
  const n = Math.max(0, Math.floor(count));
  let draft: BillDraft = { participants: [], foodItems: [] };
  for (let i = 0; i < n; i++) {
    draft = addPerson(draft, names[i]?.trim() || `คนที่ ${i + 1}`);
  }
  return addItem(draft, 'ยอดรวม', total);
}

const shortThaiDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });

/** ชื่อบิลอัตโนมัติ เช่น "บิล 13 ต.ค." ผู้ใช้แก้ได้ในหน้าผลลัพธ์ */
export function defaultBillName(date: Date = new Date()): string {
  return `บิล ${shortThaiDate.format(date)}`;
}

// จำเลขพร้อมเพย์ไว้ในเครื่อง (เฉพาะเบราว์เซอร์นี้) เพื่อไม่ต้องพิมพ์ใหม่ทุกบิล
const PROMPTPAY_KEY = 'buddypay:promptpay';

export function loadSavedPromptPay(): string {
  try {
    return window.localStorage.getItem(PROMPTPAY_KEY) || '';
  } catch {
    return '';
  }
}

export function savePromptPay(value: string): void {
  try {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length === 10 || digits.length === 13) window.localStorage.setItem(PROMPTPAY_KEY, digits);
    else if (!digits) window.localStorage.removeItem(PROMPTPAY_KEY);
  } catch {
    // เบราว์เซอร์ไม่ให้เก็บข้อมูล (เช่นโหมดส่วนตัว) ก็ใช้งานต่อได้ แค่ต้องพิมพ์ใหม่
  }
}

// เก็บบิลที่กำลังกรอกไว้ใน sessionStorage: ถ้าต้องล็อกอินกลางทาง (หน้าเว็บถูกพาไปหน้าอื่น)
// หรือเผลอรีเฟรช บิลจะไม่หาย ปิดแท็บแล้วหายเอง
const SESSION_KEY = 'buddypay:draft';

export interface SessionDraft extends BillDraft {
  billName: string;
  vat: number;
  serviceCharge: number;
  discount: number;
  notes?: string;
  view: 'edit' | 'result';
  mode: 'items' | 'quick';
  pendingSave?: boolean;
}

export function saveSessionDraft(value: SessionDraft): void {
  try {
    if (value.participants.length === 0 && value.foodItems.length === 0) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    // เก็บไม่ได้ก็ใช้งานต่อได้ตามปกติ
  }
}

export function loadSessionDraft(): SessionDraft | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || !Array.isArray(v.participants) || !Array.isArray(v.foodItems)) return null;
    return v as SessionDraft;
  } catch {
    return null;
  }
}

export function clearSessionDraft(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ไม่เป็นไร
  }
}
