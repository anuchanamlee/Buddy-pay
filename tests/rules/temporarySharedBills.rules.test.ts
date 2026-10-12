/**
 * ทดสอบ Firestore Security Rules ของ temporary_shared_bills (ลิงก์แชร์บิลชั่วคราว)
 * ผู้เขียนคือ /api/share/create ซึ่งใช้ client SDK แบบไม่ล็อกอิน
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const SHARE_ID = '0123456789abcdef0123456789abcdef';
const HOUR = 60 * 60 * 1000;

function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function validShare(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    billName: 'หมูกระทะ',
    totalAmount: 400,
    vat: 7,
    discount: 0,
    serviceCharge: 10,
    splitMethod: 'equal',
    categoryId: 'food',
    participants: [{ id: 'p1', name: 'เอ', status: 'pending' }],
    foodItems: [{ id: 'f1', name: 'หมู', price: 400, participants: ['p1'] }],
    splitResults: [],
    promptPayId: '0812345678',
    notes: '',
    shareId: SHARE_ID,
    createdAt: new Date(now).toISOString(),
    expiryDate: new Date(now + 24 * HOUR).toISOString(),
    expiresAt: new Date(now + 24 * HOUR),
    isTemporary: true,
    type: 'temp_share',
    ...overrides,
  };
}

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

describe('temporary_shared_bills: create', () => {
  it('ผู้ใช้ที่ไม่ล็อกอินสร้างลิงก์แชร์ที่ถูกต้องได้ (ตรงกับ /api/share/create)', async () => {
    await assertSucceeds(setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), validShare()));
  });

  it('ห้ามเก็บฟิลด์นอก allowlist เช่น bills (ประวัติบิลทั้งหมดของผู้ใช้)', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), validShare({ bills: [{ id: 'x' }] })),
    );
  });

  it('ห้ามขาดฟิลด์ที่จำเป็น', async () => {
    const { participants: _omit, ...missing } = validShare();
    void _omit;
    await assertFails(setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), missing));
  });

  it('ห้ามตั้งวันหมดอายุนานเกิน 24 ชม. (+1 ชม. เผื่อเวลาคลาด)', async () => {
    await assertFails(
      setDoc(
        doc(anonDb(), 'temporary_shared_bills', SHARE_ID),
        validShare({ expiresAt: new Date(Date.now() + 30 * 24 * HOUR) }),
      ),
    );
  });

  it('ห้ามสร้างเอกสารที่หมดอายุไปแล้ว', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), validShare({ expiresAt: new Date(Date.now() - HOUR) })),
    );
  });

  it('ห้าม expiresAt ที่ไม่ใช่ timestamp', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), validShare({ expiresAt: '2999-01-01' })),
    );
  });

  it('shareId ในเอกสารต้องตรงกับ document ID', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), validShare({ shareId: 'f'.repeat(32) })),
    );
  });

  it('document ID ต้องเป็น hex 32 ตัว (ป้องกันการตั้ง ID ที่เดาง่าย)', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'temporary_shared_bills', 'my-bill'), validShare({ shareId: 'my-bill' })),
    );
  });

  it('จำกัดผู้ร่วมจ่ายไม่เกิน 50 คน', async () => {
    const participants = Array.from({ length: 51 }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
    await assertFails(
      setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), validShare({ participants })),
    );
  });

  it('จำกัดความยาวโน้ตไม่เกิน 1000 ตัวอักษร', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), validShare({ notes: 'x'.repeat(1001) })),
    );
  });

  it('ห้ามใช้ type หรือ isTemporary อื่น', async () => {
    await assertFails(
      setDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), validShare({ isTemporary: false })),
    );
  });
});

describe('temporary_shared_bills: read / update / delete', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'temporary_shared_bills', SHARE_ID), validShare());
    });
  });

  it('อ่านทีละเอกสารด้วย ID ได้ (ตรงกับ /api/share/[id])', async () => {
    await assertSucceeds(getDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID)));
  });

  it('ห้าม list ลิงก์แชร์ทั้งหมด', async () => {
    await assertFails(getDocs(collection(anonDb(), 'temporary_shared_bills')));
  });

  it('ผู้ใช้ที่ล็อกอินก็ list ไม่ได้', async () => {
    const authedDb = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    await assertFails(getDocs(collection(authedDb, 'temporary_shared_bills')));
  });

  it('ห้ามแก้ไข', async () => {
    await assertFails(updateDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID), { billName: 'hacked' }));
  });

  it('ห้ามลบ', async () => {
    await assertFails(deleteDoc(doc(anonDb(), 'temporary_shared_bills', SHARE_ID)));
  });
});
