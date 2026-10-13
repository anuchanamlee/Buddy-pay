import { shareOf } from '@/app/lib/billShares';
// ตรรกะอัพเดตสถานะการจ่ายเงินของบิล ใช้ร่วมกับหน้าประวัติบิล
// ผลลัพธ์ต้องตรงกับ updatePaymentStatus ในหน้ารายละเอียดบิล (participants, splitResults, status)

export type PaymentStatus = 'paid' | 'pending';

export interface PaymentParticipant {
  id: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

export interface PaymentSplitResult {
  participant?: PaymentParticipant;
  amount?: number;
  [key: string]: unknown;
}

export interface PaymentBillLike {
  participants?: PaymentParticipant[];
  splitResults?: PaymentSplitResult[];
  status?: string;
  [key: string]: unknown;
}

export interface PaymentUpdate {
  participants: PaymentParticipant[];
  splitResults: PaymentSplitResult[] | undefined;
  status: PaymentStatus;
}

/** เปลี่ยนสถานะผู้เข้าร่วมหนึ่งคน แล้วคำนวณสถานะทั้งบิลใหม่ */
export function applyPaymentStatus(
  bill: PaymentBillLike,
  participantId: string,
  newStatus: PaymentStatus
): PaymentUpdate {
  const participants = (bill.participants || []).map((p) =>
    p.id === participantId ? { ...p, status: newStatus } : p
  );
  const splitResults = Array.isArray(bill.splitResults)
    ? bill.splitResults.map((sr) =>
        sr.participant && sr.participant.id === participantId
          ? { ...sr, participant: { ...sr.participant, status: newStatus } }
          : sr
      )
    : bill.splitResults;
  const allPaid = participants.length > 0 && participants.every((p) => p.status === 'paid');
  return { participants, splitResults, status: allPaid ? 'paid' : 'pending' };
}

/** จำนวนคนที่ยังไม่จ่าย */
export function countPending(bill: PaymentBillLike): number {
  return (bill.participants || []).filter((p) => p.status !== 'paid').length;
}

/** ยอดที่ผู้เข้าร่วมต้องจ่าย จาก splitResults (ไม่มีข้อมูลคืน null) */
export function getAmountOwed(bill: PaymentBillLike, participantId: string): number | null {
  // คำนวณจากรายการด้วยสูตรเดียวกับหน้ารายละเอียด ถ้าบิลไม่มีรายการ ค่อยใช้ splitResults ที่เก็บไว้
  const fresh = shareOf(bill as Parameters<typeof shareOf>[0], participantId);
  if (fresh !== null) return fresh;
  if (!Array.isArray(bill.splitResults)) return null;
  const row = bill.splitResults.find((sr) => sr.participant && sr.participant.id === participantId);
  return row && typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : null;
}
