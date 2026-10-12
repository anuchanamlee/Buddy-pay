/**
 * ทดสอบการแยกข้อมูลระหว่างผู้ใช้ (data isolation) ของ collection ที่เหลือ
 * พบจาก security audit: ผู้ใช้ที่ล็อกอินอ่าน/เขียนข้อมูลของคนอื่น หรือโอนข้อมูลเข้าบัญชีคนอื่นได้
 *
 * รันผ่าน Firestore Emulator เท่านั้น: `npm run test:rules`
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
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-buddypay-rules';

let testEnv: RulesTestEnvironment;

const ALICE = { uid: 'alice', email: 'alice@example.com' };
const MALLORY = { uid: 'mallory', email: 'mallory@example.com' };
const ADMIN = { uid: 'admin-1', email: 'admin@example.com' };

const asUser = (u: { uid: string; email: string }) =>
  testEnv.authenticatedContext(u.uid, { email: u.email }).firestore();
const anonymous = () => testEnv.unauthenticatedContext().firestore();

async function seed(path: string, id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path, id), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed('users', ADMIN.uid, { uid: ADMIN.uid, email: ADMIN.email, role: 'admin', status: 'active' });
  await seed('users', ALICE.uid, { uid: ALICE.uid, email: ALICE.email, role: 'user', status: 'active' });
  await seed('users', MALLORY.uid, { uid: MALLORY.uid, email: MALLORY.email, role: 'user', status: 'active' });
});

describe('activityLogs (บันทึกการกระทำของ admin)', () => {
  beforeEach(async () => {
    await seed('activityLogs', 'admin_1', {
      action: 'role_change',
      description: 'เปลี่ยนสิทธิ์ alice@example.com',
      userEmail: ADMIN.email,
    });
  });

  it('ผู้ใช้ทั่วไปอ่าน log ไม่ได้', async () => {
    await assertFails(getDoc(doc(asUser(MALLORY), 'activityLogs', 'admin_1')));
    await assertFails(getDocs(collection(asUser(MALLORY), 'activityLogs')));
  });

  it('ผู้ใช้ทั่วไปปลอม log ของ admin ไม่ได้', async () => {
    await assertFails(
      setDoc(doc(asUser(MALLORY), 'activityLogs', 'admin_fake'), {
        action: 'role_change',
        description: 'ปลอม',
        userEmail: ADMIN.email,
      }),
    );
  });

  it('admin อ่านและเขียน log ได้', async () => {
    await assertSucceeds(getDocs(collection(asUser(ADMIN), 'activityLogs')));
    await assertSucceeds(
      setDoc(doc(asUser(ADMIN), 'activityLogs', 'admin_2'), { action: 'x', userEmail: ADMIN.email }),
    );
  });
});

describe('billActivities', () => {
  it('ผู้ใช้อ่านกิจกรรมบิลของคนอื่นไม่ได้', async () => {
    await seed('billActivities', 'a1', { billId: 'b1', userId: ALICE.uid, action: 'paid' });
    await assertFails(getDocs(collection(asUser(MALLORY), 'billActivities')));
  });
});

describe('bills: โอนบิลเข้าบัญชีคนอื่น', () => {
  it('เจ้าของเปลี่ยน userId ของบิลเป็นของคนอื่นไม่ได้', async () => {
    await seed('bills', 'b1', { userId: MALLORY.uid, name: 'บิลปลอม', totalAmount: 99999 });
    await assertFails(updateDoc(doc(asUser(MALLORY), 'bills', 'b1'), { userId: ALICE.uid }));
  });

  it('เจ้าของแก้บิลของตัวเองได้ตามปกติ', async () => {
    await seed('bills', 'b2', { userId: ALICE.uid, name: 'ข้าวเย็น', totalAmount: 300 });
    await assertSucceeds(updateDoc(doc(asUser(ALICE), 'bills', 'b2'), { name: 'ข้าวเที่ยง' }));
  });
});

describe('participantGroups: โอนกลุ่มเข้าบัญชีคนอื่น', () => {
  it('เจ้าของเปลี่ยน userId ของกลุ่มเป็นของคนอื่นไม่ได้', async () => {
    await seed('participantGroups', 'g1', { userId: MALLORY.uid, name: 'กลุ่ม' });
    await assertFails(updateDoc(doc(asUser(MALLORY), 'participantGroups', 'g1'), { userId: ALICE.uid }));
  });
});

describe('notifications: ปลอมแจ้งเตือนให้คนอื่น', () => {
  it('ผู้ใช้สร้างแจ้งเตือนในนามบิลของคนอื่นไม่ได้', async () => {
    await assertFails(
      setDoc(doc(asUser(MALLORY), 'notifications', 'n1'), {
        billCreatorId: ALICE.uid,
        message: 'โอนเงินด่วนไปที่บัญชีนี้',
      }),
    );
  });
});

describe('shared_bills (ระบบแชร์เก่าที่เลิกใช้แล้ว)', () => {
  it('คนที่ไม่ได้ล็อกอินอ่านรายการทั้ง collection ไม่ได้', async () => {
    await seed('shared_bills', 's1', { userId: ALICE.uid, billName: 'x', promptPayId: '0812345678' });
    await assertFails(getDocs(collection(anonymous(), 'shared_bills')));
  });
});
