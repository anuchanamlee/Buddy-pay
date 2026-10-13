import { describe, expect, it } from 'vitest';
import { billShares, shareOf } from '@/app/lib/billShares';

const oldBill = {
  splitMethod: 'equal',
  participants: [
    { id: 'a', name: 'A', status: 'paid' },
    { id: 'b', name: 'B', status: 'pending' },
    { id: 'c', name: 'C', status: 'pending' },
  ],
  foodItems: [{ id: 'f', name: 'หมู', price: '100', participants: [] }],
  // ค่าที่บิลเก่าเก็บไว้ (สูตรเดิม ไม่ปัดสตางค์ รวมได้ 99.99)
  splitResults: ['a', 'b', 'c'].map((id) => ({ participant: { id, name: id, status: 'pending' as const }, amount: 33.33, items: [] })),
};

describe('billShares', () => {
  it('คำนวณยอดบิลเก่าใหม่ให้รวมได้เท่ายอดบิล และใช้สถานะจาก participants', () => {
    const r = billShares(oldBill);
    expect(r.map((x) => x.amount)).toEqual([33.34, 33.33, 33.33]);
    expect(r[0].participant.status).toBe('paid');
    expect(shareOf(oldBill, 'b')).toBe(33.33);
  });
  it('บิลที่ไม่มีรายการใช้ splitResults ที่เก็บไว้', () => {
    expect(billShares({ ...oldBill, foodItems: [] }).map((x) => x.amount)).toEqual([33.33, 33.33, 33.33]);
    expect(shareOf({}, 'x')).toBeNull();
  });
});
