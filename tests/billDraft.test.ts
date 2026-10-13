import { describe, expect, it } from 'vitest';
import {
  addItem,
  addPerson,
  defaultBillName,
  isEveryone,
  quickDraft,
  removeItem,
  removePerson,
  renamePerson,
  setEveryone,
  toggleEater,
  updateItem,
  whatIsMissing,
  type BillDraft,
} from '@/app/lib/billDraft';
import { calculateSplit } from '@/app/lib/billCalculator';
import { toSatang } from '@/app/lib/money';
import type { Bill } from '@/app/lib/schema';

const empty: BillDraft = { participants: [], foodItems: [] };
const withPeople = (...names: string[]) => names.reduce((d, n) => addPerson(d, n, n), empty);
const split = (d: BillDraft, extra: Partial<Bill> = {}) =>
  calculateSplit({
    name: 't', categoryId: 'food', totalAmount: 0, vat: 0, discount: 0, serviceCharge: 0,
    createdAt: new Date(0), status: 'pending', splitMethod: 'itemized', ...d, ...extra,
  } as Bill);
const amounts = (d: BillDraft, extra?: Partial<Bill>) => split(d, extra).map((r) => r.amount);
const sumSatang = (xs: number[]) => xs.reduce((a, b) => a + toSatang(b), 0);

describe('addPerson', () => {
  it('ไม่เพิ่มชื่อว่างหรือชื่อซ้ำ และตัดช่องว่าง', () => {
    let d = addPerson(empty, '  มิ้นท์  ', 'a');
    d = addPerson(d, '   ');
    d = addPerson(d, 'มิ้นท์');
    expect(d.participants.map((p) => p.name)).toEqual(['มิ้นท์']);
  });
  it('คนที่เพิ่มทีหลังเข้าไปในรายการที่ทุกคนกิน แต่ไม่เข้ารายการที่ถูกเลือกเฉพาะคน', () => {
    let d = withPeople('a', 'b');
    d = addItem(d, 'หมู', 100, 'i1');
    d = addItem(d, 'เบียร์', 60, 'i2');
    d = toggleEater(d, 'i2', 'b'); // เบียร์ a กินคนเดียว
    d = addPerson(d, 'c', 'c');
    expect(d.foodItems.find((i) => i.id === 'i1')!.participants).toEqual(['a', 'b', 'c']);
    expect(d.foodItems.find((i) => i.id === 'i2')!.participants).toEqual(['a']);
  });
});

describe('removePerson', () => {
  it('ลบออกจากทุกรายการ ยอดรวมยังเท่าเดิม', () => {
    let d = withPeople('a', 'b', 'c');
    d = addItem(d, 'หมู', 100, 'i1');
    d = removePerson(d, 'c');
    expect(d.foodItems[0].participants).toEqual(['a', 'b']);
    expect(sumSatang(amounts(d))).toBe(10000);
  });
  it('รายการที่ไม่เหลือคนกินกลับเป็นทุกคนกิน ยอดไม่หาย', () => {
    let d = withPeople('a', 'b', 'c');
    d = addItem(d, 'เบียร์', 90, 'i1');
    d = toggleEater(d, 'i1', 'a');
    d = toggleEater(d, 'i1', 'b'); // เหลือ c คนเดียว
    d = removePerson(d, 'c');
    expect(d.foodItems[0].participants).toEqual(['a', 'b']);
    expect(sumSatang(amounts(d))).toBe(9000);
  });
});

describe('renamePerson', () => {
  it('เปลี่ยนชื่อได้ ชื่อว่างไม่เปลี่ยน', () => {
    let d = withPeople('a');
    d = renamePerson(d, 'a', 'เอ');
    d = renamePerson(d, 'a', '  ');
    expect(d.participants[0].name).toBe('เอ');
  });
});

describe('addItem / updateItem / removeItem', () => {
  it('ราคา 0 ติดลบ หรือไม่ใช่ตัวเลขไม่ถูกเพิ่ม', () => {
    let d = withPeople('a', 'b');
    d = addItem(d, 'x', 0);
    d = addItem(d, 'x', -5);
    d = addItem(d, 'x', Number.NaN);
    expect(d.foodItems).toHaveLength(0);
  });
  it('ไม่ใส่ชื่อได้ชื่อ "รายการ n" และทุกคนกิน', () => {
    const d = addItem(withPeople('a', 'b'), ' ', 50);
    expect(d.foodItems[0].name).toBe('รายการ 1');
    expect(isEveryone(d.foodItems[0], d.participants)).toBe(true);
  });
  it('แก้ราคาและชื่อได้ ค่าไม่ถูกต้องไม่ถูกบันทึก', () => {
    let d = addItem(withPeople('a', 'b'), 'x', 50, 'i1');
    d = updateItem(d, 'i1', { price: 80.555, name: 'ข้าว' });
    d = updateItem(d, 'i1', { price: 0, name: '' });
    expect(d.foodItems[0]).toMatchObject({ name: 'ข้าว', price: 80.56 });
    expect(removeItem(d, 'i1').foodItems).toHaveLength(0);
  });
});

describe('toggleEater / setEveryone', () => {
  it('เอาคนสุดท้ายออกไม่ได้', () => {
    let d = addItem(withPeople('a', 'b'), 'x', 50, 'i1');
    d = toggleEater(d, 'i1', 'a');
    d = toggleEater(d, 'i1', 'b');
    expect(d.foodItems[0].participants).toEqual(['b']);
  });
  it('ใส่กลับแล้วลำดับตามรายชื่อคน และ setEveryone ใส่ครบ', () => {
    let d = addItem(withPeople('a', 'b', 'c'), 'x', 50, 'i1');
    d = toggleEater(d, 'i1', 'a');
    d = toggleEater(d, 'i1', 'a');
    expect(d.foodItems[0].participants).toEqual(['a', 'b', 'c']);
    d = toggleEater(d, 'i1', 'c');
    d = setEveryone(d, 'i1');
    expect(d.foodItems[0].participants).toEqual(['a', 'b', 'c']);
  });
});

describe('ผลคำนวณเท่ากับวิธีเดิม', () => {
  it('ทุกคนกินทุกรายการ = หารเท่ากันแบบเดิม (มี VAT ค่าบริการ ส่วนลด)', () => {
    let d = withPeople('a', 'b', 'c');
    d = addItem(d, 'หมู', 333, 'i1');
    d = addItem(d, 'น้ำ', 47, 'i2');
    const extra = { vat: 7, serviceCharge: 10, discount: 20 };
    const itemized = amounts(d, extra);
    const equal = split(d, { ...extra, splitMethod: 'equal' }).map((r) => r.amount);
    expect(itemized).toEqual(equal);
  });
  it('ยอดทุกคนรวมกันเท่ายอดบิลเสมอ', () => {
    let d = withPeople('a', 'b', 'c');
    d = addItem(d, 'หมู', 100, 'i1');
    d = addItem(d, 'เบียร์', 59, 'i2');
    d = toggleEater(d, 'i2', 'c');
    const extra = { vat: 7, serviceCharge: 10, discount: 5 };
    const expected = toSatang((159 * 1.07) * 1.1 - 5);
    expect(sumSatang(amounts(d, extra))).toBe(expected);
  });
});

describe('whatIsMissing', () => {
  it('บอกสิ่งที่ยังขาด', () => {
    expect(whatIsMissing(empty)).toBe('ใส่ชื่อเพื่อนอีก 2 คน');
    expect(whatIsMissing(withPeople('a'))).toBe('ใส่ชื่อเพื่อนอีก 1 คน');
    expect(whatIsMissing(withPeople('a', 'b'))).toBe('ใส่รายการอย่างน้อย 1 รายการ');
    expect(whatIsMissing(addItem(withPeople('a', 'b'), 'x', 1))).toBeNull();
  });
});

describe('quickDraft', () => {
  it('ยอดรวม 1,000 หาร 3 คน', () => {
    const d = quickDraft(1000, 3);
    expect(d.participants.map((p) => p.name)).toEqual(['คนที่ 1', 'คนที่ 2', 'คนที่ 3']);
    expect(amounts(d)).toEqual([333.34, 333.33, 333.33]);
  });
  it('ใส่ชื่อบางคนได้', () => {
    expect(quickDraft(100, 2, ['มิ้นท์']).participants.map((p) => p.name)).toEqual(['มิ้นท์', 'คนที่ 2']);
  });
});

describe('defaultBillName', () => {
  it('ใช้วันที่ภาษาไทยแบบสั้น', () => {
    expect(defaultBillName(new Date(2026, 9, 13))).toBe('บิล 13 ต.ค.');
  });
});
