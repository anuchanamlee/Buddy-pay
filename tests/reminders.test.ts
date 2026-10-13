import { describe, expect, it } from 'vitest';
import { reminderMessage, summarizePending } from '@/app/lib/reminders';

const bill = (people: Array<[string, string, 'paid' | 'pending']>, price: number) => ({
  participants: people.map(([id, name, status]) => ({ id, name, status })),
  foodItems: [{ id: 'i1', name: 'x', price, participants: people.map(([id]) => id) }],
  splitMethod: 'itemized',
});

describe('summarizePending', () => {
  it('นับคนที่ยังไม่จ่ายและรวมยอดถึงสตางค์', () => {
    const s = summarizePending([
      bill([['a', 'มิ้นท์', 'paid'], ['b', 'บอส', 'pending'], ['c', 'ฝน', 'pending']], 100),
      bill([['d', 'บอส', 'pending'], ['e', 'เอ', 'paid']], 50),
    ]);
    expect(s.pendingCount).toBe(3);
    expect(s.billCount).toBe(2);
    expect(s.totalOwed).toBe(33.33 + 33.33 + 25);
    expect(s.names).toEqual(['บอส', 'ฝน']);
  });
  it('บิลที่จ่ายครบแล้วไม่นับ', () => {
    expect(summarizePending([bill([['a', 'a', 'paid'], ['b', 'b', 'paid']], 100)]).pendingCount).toBe(0);
  });
});

describe('reminderMessage', () => {
  it('ไม่มีคนค้าง ไม่ต้องแจ้ง', () => {
    expect(reminderMessage({ pendingCount: 0, names: [], totalOwed: 0, billCount: 0 })).toBeNull();
  });
  it('รวมชื่อและยอด', () => {
    const m = reminderMessage({ pendingCount: 2, names: ['มิ้นท์', 'บอส'], totalOwed: 540, billCount: 1 })!;
    expect(m.title).toBe('ยังมีคนค้างจ่าย 540 บาท');
    expect(m.body).toBe('มิ้นท์ และ บอส ยังไม่โอน (1 บิล) แตะเพื่อดูและทวง');
  });
  it('ชื่อเยอะ แสดง 3 คนแรก', () => {
    const m = reminderMessage({ pendingCount: 5, names: ['a', 'b', 'c', 'd', 'e'], totalOwed: 10.5, billCount: 2 })!;
    expect(m.body).toBe('a, b และ c กับอีก 2 คน ยังไม่โอน (2 บิล) แตะเพื่อดูและทวง');
  });
});
