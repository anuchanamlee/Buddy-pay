import { describe, expect, it } from 'vitest';
import { parseAmount, sanitizeDecimal, sanitizeDigits } from '@/app/lib/numericInput';

describe('sanitizeDecimal', () => {
  it('ตัดตัวอักษรทิ้ง เหลือแต่ตัวเลข', () => {
    expect(sanitizeDecimal('abc')).toBe('');
    expect(sanitizeDecimal('12a3')).toBe('123');
    expect(sanitizeDecimal('ราคา 50 บาท')).toBe('50');
    expect(sanitizeDecimal('-5')).toBe('5');
    expect(sanitizeDecimal('1e5')).toBe('15');
  });
  it('จุดทศนิยมได้จุดเดียว ไม่เกิน 2 ตำแหน่ง', () => {
    expect(sanitizeDecimal('12.')).toBe('12.');
    expect(sanitizeDecimal('12.345')).toBe('12.34');
    expect(sanitizeDecimal('1.2.3')).toBe('1.23');
    expect(sanitizeDecimal('.5')).toBe('0.5');
  });
  it('วางตัวเลขที่มีจุลภาคได้ และแปลงเลขไทย', () => {
    expect(sanitizeDecimal('1,250.50')).toBe('1250.50');
    expect(sanitizeDecimal('๑๒๓')).toBe('123');
    expect(sanitizeDecimal('００７')).toBe('7');
  });
  it('ไม่เกิน 9 หลัก', () => {
    expect(sanitizeDecimal('12345678901')).toBe('123456789');
  });
});

describe('sanitizeDigits', () => {
  it('พร้อมเพย์รับเฉพาะตัวเลขกับขีด ไม่เกิน 13 หลัก', () => {
    expect(sanitizeDigits('08a1-234-5678')).toBe('081-234-5678');
    expect(sanitizeDigits('-0812')).toBe('0812');
    expect(sanitizeDigits('12345678901234567')).toBe('1234567890123');
    expect(sanitizeDigits('081 234')).toBe('081234');
  });
});

describe('parseAmount', () => {
  it('รับเฉพาะตัวเลขล้วน', () => {
    expect(parseAmount('1,250')).toBe(1250);
    expect(parseAmount('80.5')).toBe(80.5);
    expect(parseAmount('12abc')).toBeNaN();
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
  });
});
