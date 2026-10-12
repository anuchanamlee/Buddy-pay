/**
 * ทดสอบ verifyFirebaseIdToken กับ firebase-admin ตัวจริง (ไม่ mock)
 * เพื่อยืนยันว่า token ที่ปลอมขึ้นถูกปฏิเสธ ใช้ demo project ID และไม่มี credentials
 */
import { generateKeyPairSync, createSign } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

const PROJECT_ID = 'demo-buddypay-token-test';

function base64url(input: string | Buffer) {
  return (typeof input === 'string' ? Buffer.from(input, 'utf8') : input).toString('base64url');
}

// สร้าง JWT ที่มี claim ถูกต้องทุกอย่าง แต่เซ็นด้วย key ของผู้โจมตีเอง
function forgeIdToken(header: Record<string, unknown>, sign: boolean) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    auth_time: now - 10,
    iat: now - 10,
    exp: now + 3600,
    sub: 'attacker-uid',
    user_id: 'attacker-uid',
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  if (!sign) return `${unsigned}.`;

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey);
  return `${unsigned}.${base64url(signature)}`;
}

let verifyFirebaseIdToken: (token: string) => Promise<{ uid: string }>;

beforeAll(async () => {
  process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
  ({ verifyFirebaseIdToken } = await import('@/app/lib/server/firebaseAdmin'));
});

describe('verifyFirebaseIdToken (firebase-admin จริง)', () => {
  it('ปฏิเสธ string ที่ไม่ใช่ JWT', async () => {
    await expect(verifyFirebaseIdToken('not-a-jwt')).rejects.toMatchObject({
      code: expect.stringMatching(/^auth\//),
    });
  });

  it('ปฏิเสธ token ที่ไม่มีลายเซ็น (alg: none)', async () => {
    const token = forgeIdToken({ alg: 'none', typ: 'JWT' }, false);
    await expect(verifyFirebaseIdToken(token)).rejects.toMatchObject({
      code: expect.stringMatching(/^auth\//),
    });
  });

  it('ปฏิเสธ token ที่เซ็นด้วย key ของผู้โจมตี', async () => {
    const token = forgeIdToken({ alg: 'RS256', typ: 'JWT', kid: 'attacker-key' }, true);
    await expect(verifyFirebaseIdToken(token)).rejects.toMatchObject({
      code: expect.stringMatching(/^auth\//),
    });
  });
});
