import { describe, expect, it } from 'vitest';
import { getSignInMethod, USER_OWNED_COLLECTIONS } from '@/app/lib/services/accountDeletion';

const withProviders = (...ids: string[]) => ({ providerData: ids.map((providerId) => ({ providerId })) }) as any;

describe('getSignInMethod', () => {
  it('บัญชีอีเมล/รหัสผ่านใช้รหัสผ่านยืนยัน', () => {
    expect(getSignInMethod(withProviders('password'))).toBe('password');
  });
  it('บัญชี Google ใช้ popup ยืนยัน', () => {
    expect(getSignInMethod(withProviders('google.com'))).toBe('google');
  });
  it('บัญชีที่ผูกทั้งสองแบบใช้รหัสผ่านก่อน', () => {
    expect(getSignInMethod(withProviders('google.com', 'password'))).toBe('password');
  });
  it('ไม่รู้จัก provider', () => {
    expect(getSignInMethod(withProviders())).toBe('other');
  });
});

describe('USER_OWNED_COLLECTIONS', () => {
  it('ครอบคลุมทุก collection ที่ผูกกับผู้ใช้ด้วย userId', () => {
    expect([...USER_OWNED_COLLECTIONS].sort()).toEqual(['billActivities', 'bills', 'participantGroups']);
  });
});
