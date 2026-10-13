import { describe, expect, it } from 'vitest';
import { applyPaymentStatus, countPending, getAmountOwed } from '@/app/components/history/paymentLogic';

const makeBill = () => ({
  status: 'pending',
  participants: [
    { id: 'a', name: 'เอ', status: 'paid' },
    { id: 'b', name: 'บี', status: 'pending' },
  ],
  splitResults: [
    { participant: { id: 'a', name: 'เอ', status: 'paid' }, amount: 100 },
    { participant: { id: 'b', name: 'บี', status: 'pending' }, amount: 150 },
  ],
});

describe('applyPaymentStatus', () => {
  it('อัพเดตทั้ง participants และ splitResults ของคนที่เลือก', () => {
    const r = applyPaymentStatus(makeBill(), 'b', 'paid');
    expect(r.participants[1].status).toBe('paid');
    expect(r.splitResults?.[1].participant?.status).toBe('paid');
    expect(r.splitResults?.[1].amount).toBe(150);
  });
  it('ทุกคนจ่ายแล้วบิลเป็น paid', () => {
    expect(applyPaymentStatus(makeBill(), 'b', 'paid').status).toBe('paid');
  });
  it('ยกเลิกการจ่ายแล้วบิลกลับเป็น pending', () => {
    const paid = applyPaymentStatus(makeBill(), 'b', 'paid');
    const back = applyPaymentStatus({ ...makeBill(), ...paid }, 'b', 'pending');
    expect(back.status).toBe('pending');
    expect(back.participants[1].status).toBe('pending');
  });
  it('ไม่แก้ข้อมูลเดิม', () => {
    const bill = makeBill();
    applyPaymentStatus(bill, 'b', 'paid');
    expect(bill.participants[1].status).toBe('pending');
  });
  it('ไม่มี splitResults ก็ทำงานได้', () => {
    const bill = { participants: [{ id: 'a', status: 'pending' }] };
    const r = applyPaymentStatus(bill, 'a', 'paid');
    expect(r.splitResults).toBeUndefined();
    expect(r.status).toBe('paid');
  });
  it('ไม่มีผู้เข้าร่วมเป็น pending', () => {
    expect(applyPaymentStatus({}, 'x', 'paid').status).toBe('pending');
  });
});

describe('countPending / getAmountOwed', () => {
  it('นับคนที่ยังไม่จ่าย', () => {
    expect(countPending(makeBill())).toBe(1);
  });
  it('อ่านยอดจาก splitResults ตาม id', () => {
    expect(getAmountOwed(makeBill(), 'b')).toBe(150);
    expect(getAmountOwed(makeBill(), 'zzz')).toBeNull();
    expect(getAmountOwed({ participants: [] }, 'a')).toBeNull();
  });
});
