// สรุปคนที่ยังค้างจ่ายจากบิลของเจ้าของ ใช้ทั้งตัวเลขบนไอคอนแอปและข้อความแจ้งเตือนทวงเงิน
import { billShares } from './billShares';
import { fromSatang, toSatang } from './money';
import { formatTHB } from './format';

type StoredBill = Parameters<typeof billShares>[0] & { name?: string; title?: string };

export interface PendingSummary {
  /** จำนวนครั้งที่ต้องเก็บเงิน (คนเดียวกันค้าง 2 บิล นับ 2) ใช้เป็นตัวเลขบนไอคอน */
  pendingCount: number;
  /** ชื่อคนที่ค้าง ไม่ซ้ำ เรียงตามยอดค้างมากไปน้อย */
  names: string[];
  totalOwed: number;
  billCount: number;
}

export function summarizePending(bills: StoredBill[]): PendingSummary {
  const byName = new Map<string, number>(); // ชื่อ → ยอดค้าง (สตางค์)
  let pendingCount = 0;
  let billCount = 0;
  let total = 0;
  for (const bill of bills) {
    const pending = (bill.participants || []).filter((p) => p && p.status !== 'paid');
    if (pending.length === 0) continue;
    billCount++;
    const shares = billShares(bill);
    for (const p of pending) {
      const amount = toSatang(shares.find((r) => r.participant?.id === p.id)?.amount || 0);
      if (amount <= 0) continue; // คนที่ไม่ได้กินอะไรในบิลนี้ ไม่ต้องทวง
      pendingCount++;
      total += amount;
      const name = (p.name || '').trim() || 'ไม่มีชื่อ';
      byName.set(name, (byName.get(name) || 0) + amount);
    }
  }
  const names = Array.from(byName.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  return { pendingCount, names, totalOwed: fromSatang(total), billCount };
}

/** ข้อความแจ้งเตือน เช่น "มิ้นท์ และ บอส ยังไม่โอน รวม 540 บาท" (null = ไม่มีใครค้าง ไม่ต้องแจ้ง) */
export function reminderMessage(summary: PendingSummary): { title: string; body: string } | null {
  if (summary.pendingCount === 0) return null;
  const shown = summary.names.slice(0, 3);
  const more = summary.names.length - shown.length;
  const who = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} และ ${shown[shown.length - 1]}`;
  const tail = more > 0 ? ` กับอีก ${more} คน` : '';
  return {
    title: `ยังมีคนค้างจ่าย ${formatTHB(summary.totalOwed)} บาท`,
    body: `${who}${tail} ยังไม่โอน (${summary.billCount} บิล) แตะเพื่อดูและทวง`,
  };
}
