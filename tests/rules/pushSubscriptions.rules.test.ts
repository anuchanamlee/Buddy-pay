/**
 * การสมัครรับแจ้งเตือนทวงเงิน: เจ้าของจัดการของตัวเองได้ คนอื่นอ่าน/ลบ/ปลอมไม่ได้
 * รันผ่าน Firestore Emulator: `npm run test:rules`
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;
const ID = 'a'.repeat(64);
const sub = (userId: string) => ({
  userId,
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: 'BOr-key', auth: 'auth-secret' },
  createdAt: new Date(),
});
const as = (uid: string) => testEnv.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-buddypay-rules',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => testEnv.cleanup());
beforeEach(async () => testEnv.clearFirestore());

describe('pushSubscriptions', () => {
  it('เจ้าของสมัคร อ่าน และยกเลิกของตัวเองได้', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'pushSubscriptions', ID), sub('alice')));
    await assertSucceeds(getDoc(doc(as('alice'), 'pushSubscriptions', ID)));
    await assertSucceeds(deleteDoc(doc(as('alice'), 'pushSubscriptions', ID)));
  });

  it('สมัครในนามคนอื่นไม่ได้ และไม่ล็อกอินสมัครไม่ได้', async () => {
    await assertFails(setDoc(doc(as('mallory'), 'pushSubscriptions', ID), sub('alice')));
    await assertFails(setDoc(doc(testEnv.unauthenticatedContext().firestore(), 'pushSubscriptions', ID), sub('alice')));
  });

  it('คนอื่นอ่านหรือลบของเจ้าของไม่ได้', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pushSubscriptions', ID), sub('alice'));
    });
    await assertFails(getDoc(doc(as('mallory'), 'pushSubscriptions', ID)));
    await assertFails(deleteDoc(doc(as('mallory'), 'pushSubscriptions', ID)));
  });

  it('ข้อมูลผิดรูปแบบถูกปฏิเสธ', async () => {
    await assertFails(setDoc(doc(as('alice'), 'pushSubscriptions', 'short-id'), sub('alice')));
    await assertFails(setDoc(doc(as('alice'), 'pushSubscriptions', ID), { ...sub('alice'), endpoint: 'http://evil' }));
    await assertFails(setDoc(doc(as('alice'), 'pushSubscriptions', ID), { ...sub('alice'), extra: 1 }));
  });
});
