/**
 * Regression tests ของการคำนวณบิล (ฟีเจอร์หลัก)
 * ยืนยันพฤติกรรมปัจจุบันตามตัวอย่างที่เขียนไว้ใน app/lib/billCalculator.ts
 * ไม่ได้แก้ logic การคำนวณ
 */
import { describe, expect, it } from 'vitest';
import { calculateSplit } from '@/app/lib/billCalculator';
import type { Bill } from '@/app/lib/schema';

function makeBill(overrides: Partial<Bill>): Bill {
  return {
    name: 'ทดสอบ',
    categoryId: 'other',
    totalAmount: 0,
    foodItems: [],
    participants: [],
    vat: 0,
    discount: 0,
    serviceCharge: 0,
    splitMethod: 'equal',
    createdAt: new Date(0),
    status: 'pending',
    ...overrides,
  };
}

const people = (...ids: string[]) => ids.map((id) => ({ id, name: id.toUpperCase(), status: 'pending' as const }));

describe('calculateSplit: หารเท่ากัน', () => {
  it('คิด VAT ก่อน แล้วคิดค่าบริการจากยอดหลัง VAT และหักส่วนลด (ตัวอย่างในโค้ด: 125.3 บาท)', () => {
    const bill = makeBill({
      splitMethod: 'equal',
      participants: people('a'),
      foodItems: [{ id: 'f1', name: 'ข้าว', price: 120, participants: ['a'] }],
      vat: 5,
      serviceCharge: 5,
      discount: 7,
    });

    const [result] = calculateSplit(bill);
    expect(result.amount).toBe(125.3);
  });

  it('หารยอดรวมเท่ากันทุกคน', () => {
    const bill = makeBill({
      splitMethod: 'equal',
      participants: people('a', 'b', 'c', 'd'),
      foodItems: [{ id: 'f1', name: 'หมูกระทะ', price: 400, participants: [] }],
    });

    expect(calculateSplit(bill).map((r) => r.amount)).toEqual([100, 100, 100, 100]);
  });

  it('ไม่มีผู้ร่วมจ่ายคืนผลลัพธ์ว่าง', () => {
    expect(calculateSplit(makeBill({ splitMethod: 'equal' }))).toEqual([]);
  });
});

describe('calculateSplit: หารตามรายการที่กิน', () => {
  it('กระจาย VAT ค่าบริการ และส่วนลดตามสัดส่วน (ตัวอย่างในโค้ด: A 100.25, B 200.5, C 0)', () => {
    const bill = makeBill({
      splitMethod: 'itemized',
      participants: people('a', 'b', 'c'),
      foodItems: [
        { id: 'f1', name: 'สเต๊ก', price: 100, participants: ['a'] },
        { id: 'f2', name: 'ล็อบสเตอร์', price: 200, participants: ['b'] },
      ],
      vat: 5,
      serviceCharge: 5,
      discount: 30,
    });

    expect(calculateSplit(bill).map((r) => [r.participant.id, r.amount])).toEqual([
      ['a', 100.25],
      ['b', 200.5],
      ['c', 0],
    ]);
  });

  it('หารราคาอาหารที่กินร่วมกันเท่า ๆ กันระหว่างคนที่กิน', () => {
    const bill = makeBill({
      splitMethod: 'itemized',
      participants: people('a', 'b'),
      foodItems: [
        { id: 'f1', name: 'พิซซ่า', price: 300, participants: ['a', 'b'] },
        { id: 'f2', name: 'น้ำ', price: 20, participants: ['b'] },
      ],
    });

    expect(calculateSplit(bill).map((r) => r.amount)).toEqual([150, 170]);
  });
});
