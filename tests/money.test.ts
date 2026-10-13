import { describe, expect, it } from 'vitest';
import { allocateSatang, fromSatang, toSatang } from '@/app/lib/money';
import { calculateSplit } from '@/app/lib/billCalculator';
import type { Bill } from '@/app/lib/schema';

describe('toSatang / fromSatang', () => {
  it('ปัดเศษถูกต้องแม้ทศนิยม JS เพี้ยน', () => {
    expect(toSatang(1.005)).toBe(101);
    expect(toSatang(0.1 + 0.2)).toBe(30);
    expect(toSatang(33.333)).toBe(3333);
    expect(fromSatang(3334)).toBe(33.34);
  });
});

describe('allocateSatang', () => {
  it('100 บาทหาร 3 ได้ 33.34, 33.33, 33.33 และรวมกันได้ 100 พอดี', () => {
    const r = allocateSatang(10000, [1, 1, 1]);
    expect(r).toEqual([3334, 3333, 3333]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(10000);
  });
  it('แบ่งตามสัดส่วน และคนน้ำหนัก 0 ได้ 0', () => {
    const r = allocateSatang(1001, [1, 2, 0]);
    expect(r[2]).toBe(0);
    expect(r[0] + r[1]).toBe(1001);
  });
  it('กรณีขอบ', () => {
    expect(allocateSatang(500, [])).toEqual([]);
    expect(allocateSatang(500, [0, 0])).toEqual([0, 0]);
    expect(allocateSatang(-5, [1])).toEqual([0]);
  });
});

const makeBill = (o: Partial<Bill>): Bill => ({
  name: 't', categoryId: 'other', totalAmount: 0, foodItems: [], participants: [], vat: 0, discount: 0,
  serviceCharge: 0, splitMethod: 'equal', createdAt: new Date(0), status: 'pending', ...o,
});
const people = (...ids: string[]) => ids.map((id) => ({ id, name: id, status: 'pending' as const }));
const sumSatang = (xs: number[]) => xs.reduce((a, b) => a + toSatang(b), 0);

describe('calculateSplit รวมยอดได้เท่ายอดบิลพอดี', () => {
  it('หารเท่ากัน 100 บาท 3 คน', () => {
    const r = calculateSplit(makeBill({ participants: people('a', 'b', 'c'), foodItems: [{ id: 'f', name: 'x', price: 100, participants: [] }] }));
    expect(r.map((x) => x.amount)).toEqual([33.34, 33.33, 33.33]);
    expect(sumSatang(r.map((x) => x.amount))).toBe(10000);
  });
  it('หารตามรายการ อาหารที่หารไม่ลงตัว 3 คน', () => {
    const r = calculateSplit(makeBill({
      splitMethod: 'itemized', participants: people('a', 'b', 'c'), vat: 7, serviceCharge: 10,
      foodItems: [{ id: 'f', name: 'x', price: 100, participants: ['a', 'b', 'c'] }, { id: 'g', name: 'y', price: 59, participants: ['a'] }],
    }));
    const expected = toSatang((159 * 1.07) * 1.1);
    expect(sumSatang(r.map((x) => x.amount))).toBe(expected);
  });
});
