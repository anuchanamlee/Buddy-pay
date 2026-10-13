import { describe, expect, it } from 'vitest';
import { formatTHB, formatThaiDate, toDate } from '@/app/lib/format';

describe('toDate', () => {
  const iso = '2026-10-12T15:00:00.000Z';
  const expected = new Date(iso).getTime();

  it('รับ Date object (เดิม formatDate มองว่าเป็น object ว่างแล้วขึ้น "ไม่ระบุวันที่")', () => {
    expect(toDate(new Date(iso))?.getTime()).toBe(expected);
  });
  it('รับ Firestore Timestamp ทั้งแบบมี toDate() และแบบ {seconds}', () => {
    expect(toDate({ toDate: () => new Date(iso) })?.getTime()).toBe(expected);
    expect(toDate({ seconds: expected / 1000, nanoseconds: 0 })?.getTime()).toBe(expected);
  });
  it('รับ string และ number จากแคช', () => {
    expect(toDate(iso)?.getTime()).toBe(expected);
    expect(toDate(expected)?.getTime()).toBe(expected);
  });
  it('คืน null เมื่อไม่มีค่าหรือค่าไม่ถูกต้อง', () => {
    expect(toDate(undefined)).toBeNull();
    expect(toDate('ไม่ใช่วันที่')).toBeNull();
  });
});

describe('formatThaiDate', () => {
  it('แสดงวันที่ภาษาไทยแทน "ไม่ระบุวันที่" เมื่อได้รับ Date', () => {
    expect(formatThaiDate(new Date('2026-10-12T15:00:00.000Z'))).not.toBe('ไม่ระบุวันที่');
  });
  it('ขึ้น "ไม่ระบุวันที่" เมื่อไม่มีวันที่จริง', () => {
    expect(formatThaiDate(null)).toBe('ไม่ระบุวันที่');
  });
});

describe('formatTHB', () => {
  it('แสดงสตางค์เมื่อมี และไม่ปัดเป็นบาทเต็ม', () => {
    expect(formatTHB(133.33)).toBe('133.33');
    expect(formatTHB(130)).toBe('130');
    expect(formatTHB(1415)).toBe('1,415');
    expect(formatTHB(212.5)).toBe('212.50');
    expect(formatTHB(84.7)).toBe('84.70');
    expect(formatTHB(99.999)).toBe('100');
  });
  it('ค่าที่ไม่ใช่ตัวเลขแสดงเป็น 0', () => {
    expect(formatTHB(undefined)).toBe('0');
    expect(formatTHB(Number.NaN)).toBe('0');
  });
});
