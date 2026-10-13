import { describe, expect, it } from 'vitest';
import { buildPromptPayPayload, sanitizePromptPayId } from '@/app/components/PromptPayQR';

describe('sanitizePromptPayId', () => {
  it('รับเบอร์ 10 หลักหรือเลข 13 หลัก ตัดขีดและช่องว่าง', () => {
    expect(sanitizePromptPayId('080-000-0000')).toBe('0800000000');
    expect(sanitizePromptPayId('1 2345 67890 12 3')).toBe('1234567890123');
    expect(sanitizePromptPayId('12345')).toBeNull();
    expect(sanitizePromptPayId(undefined)).toBeNull();
  });
});

describe('buildPromptPayPayload', () => {
  it('ใส่ยอดเงินลงใน QR (tag 54) เมื่อยอดมากกว่า 0', () => {
    const payload = buildPromptPayPayload('0800000000', 33.34);
    expect(payload).toContain('540533.34');
  });
  it('ยอด 0 ไม่ใส่ tag ยอดเงิน และยอดต่างกันได้ QR ต่างกัน', () => {
    expect(buildPromptPayPayload('0800000000', 0)).not.toContain('5405');
    expect(buildPromptPayPayload('0800000000', 10)).not.toBe(buildPromptPayPayload('0800000000', 20));
  });
  it('เลขพร้อมเพย์ไม่ถูกต้องได้ null', () => {
    expect(buildPromptPayPayload('123', 10)).toBeNull();
  });
});
