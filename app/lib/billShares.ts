// ยอดของแต่ละคนในบิลที่บันทึกไว้ คำนวณใหม่จากรายการด้วยสูตรเดียวกับหน้าผลลัพธ์ทุกครั้ง
// บิลเก่าเก็บ splitResults ที่คิดด้วยสูตรเดิม (ไม่ปัดเป็นสตางค์) ถ้าอ่านค่าที่เก็บไว้ตรง ๆ ยอดจะไม่ตรงกับหน้ารายละเอียด
import { calculateSplit, type SplitResult } from './billCalculator';
import type { Bill } from './schema';

type StoredBill = {
  participants?: Array<{ id: string; name: string; status?: string }>;
  foodItems?: Array<{ id: string; name: string; price: unknown; participants?: string[] }>;
  splitResults?: SplitResult[];
  splitMethod?: string;
  vat?: unknown;
  serviceCharge?: unknown;
  discount?: unknown;
};

export function billShares(bill: StoredBill): SplitResult[] {
  const participants = (bill.participants || []).filter((p) => p && typeof p === 'object' && p.id);
  const foodItems = bill.foodItems || [];
  if (participants.length === 0 || foodItems.length === 0) return Array.isArray(bill.splitResults) ? bill.splitResults : [];
  try {
    return calculateSplit({
      name: '',
      categoryId: 'other',
      totalAmount: 0,
      createdAt: new Date(0),
      status: 'pending',
      splitMethod: bill.splitMethod === 'equal' ? 'equal' : 'itemized',
      vat: Number(bill.vat) || 0,
      serviceCharge: Number(bill.serviceCharge) || 0,
      discount: Number(bill.discount) || 0,
      participants: participants.map((p) => ({ id: p.id, name: p.name, status: p.status === 'paid' ? 'paid' : 'pending' })),
      foodItems: foodItems.map((i) => ({ id: i.id, name: i.name, price: Number(i.price) || 0, participants: i.participants || [] })),
    } as Bill);
  } catch {
    return Array.isArray(bill.splitResults) ? bill.splitResults : [];
  }
}

/** ยอดที่คนนี้ต้องจ่าย (null = ไม่มีข้อมูลพอคำนวณ) */
export function shareOf(bill: StoredBill, participantId: string): number | null {
  const row = billShares(bill).find((r) => r.participant?.id === participantId);
  return row && Number.isFinite(row.amount) ? row.amount : null;
}
