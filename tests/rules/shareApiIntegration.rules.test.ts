/**
 * Integration: เอกสารที่ handleCreateShare สร้างจริง ต้องผ่าน Firestore Rules
 * เมื่อเขียนแบบไม่ล็อกอิน (เหมือน /api/share/create บน server) และอ่านกลับผ่าน handleGetShare ได้
 * ป้องกันกรณี API กับ Rules ใช้รูปแบบข้อมูลไม่ตรงกันจนสร้างลิงก์แชร์ไม่ได้
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleCreateShare, handleGetShare } from '@/app/lib/share/handlers';
import { createRateLimiter } from '@/app/lib/rateLimit';
import { realisticPayload } from '../share/fixtures';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-buddypay-rules',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('share API + Firestore Rules', () => {
  it('สร้างลิงก์จาก payload จริงของ ResultStep แล้วอ่านกลับได้', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    const createRes = await handleCreateShare(
      new Request('http://localhost/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.1' },
        body: JSON.stringify(realisticPayload()),
      }),
      {
        rateLimiter: createRateLimiter({ limit: 10, windowMs: 60_000 }),
        generateShareId: () => 'abcdefabcdefabcdefabcdefabcdef12',
        appUrl: 'https://buddypay.example',
        saveShare: async (shareId, data) => {
          await setDoc(doc(db, 'temporary_shared_bills', shareId), data);
        },
        logError: (message, meta) => console.error(message, meta),
      },
    );
    expect(createRes.status).toBe(200);
    const { shareId } = await createRes.json();

    const getRes = await handleGetShare(shareId, {
      loadShare: async (id) => {
        const snapshot = await getDoc(doc(db, 'temporary_shared_bills', id));
        return snapshot.exists() ? snapshot.data() : null;
      },
    });
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.data.billName).toBe('หมูกระทะ');
    expect(body.data.participants).toHaveLength(2);
    expect(body.data).not.toHaveProperty('bills');
  });
});
