/**
 * ทดสอบ Firestore Security Rules ของ collection `users`
 * โดยเน้นการป้องกัน privilege escalation (ผู้ใช้ตั้งตัวเองเป็น admin)
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
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-buddypay-rules';

let testEnv: RulesTestEnvironment;

const ALICE = { uid: 'alice', email: 'alice@example.com' };
const ADMIN = { uid: 'admin-1', email: 'admin@example.com' };

function aliceDb() {
  return testEnv.authenticatedContext(ALICE.uid, { email: ALICE.email }).firestore();
}

function adminDb() {
  return testEnv.authenticatedContext(ADMIN.uid, { email: ADMIN.email }).firestore();
}

// เตรียมข้อมูลโดยข้าม Security Rules (เหมือนข้อมูลที่มีอยู่แล้วในระบบ)
async function seedUser(uid: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedUser(ADMIN.uid, { uid: ADMIN.uid, email: ADMIN.email, role: 'admin', status: 'active' });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('users: การสร้างเอกสารของตัวเอง', () => {
  it('สร้างเอกสารด้วย role "user" ได้ (ตรงกับ flow สมัครสมาชิกใน FirebaseWrapper)', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), {
        uid: ALICE.uid,
        email: ALICE.email,
        displayName: 'Alice',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        lastLogin: new Date(),
      }),
    );
  });

  it('สร้างเอกสารโดยไม่ระบุ role ได้', async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), { email: ALICE.email, displayName: 'Alice' }),
    );
  });

  it('ห้ามสร้างเอกสารของตัวเองด้วย role "admin"', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), { email: ALICE.email, role: 'admin' }),
    );
  });

  it('ห้ามสร้างเอกสารด้วย role อื่นที่ไม่ใช่ "user"', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), { email: ALICE.email, role: 'superuser' }),
    );
  });

  it('ห้ามสร้างเอกสารด้วย status อื่นที่ไม่ใช่ "active"', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), { email: ALICE.email, status: 'vip' }),
    );
  });

  it('ห้ามใส่ email ที่ไม่ตรงกับ email ใน ID token', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), { email: 'someone-else@example.com', role: 'user' }),
    );
  });

  it('ห้ามใส่ฟิลด์ที่ไม่อยู่ใน allowlist', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), { email: ALICE.email, isAdmin: true }),
    );
  });

  it('ห้ามสร้างเอกสารให้ผู้ใช้คนอื่น', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', 'bob'), { email: ALICE.email, role: 'user' }),
    );
  });

  it('ผู้ใช้ที่ไม่ได้ล็อกอินสร้างเอกสารไม่ได้', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anonDb, 'users', ALICE.uid), { role: 'user' }));
  });
});

describe('users: การแก้ไขเอกสารของตัวเอง', () => {
  beforeEach(async () => {
    await seedUser(ALICE.uid, {
      uid: ALICE.uid,
      email: ALICE.email,
      displayName: 'Alice',
      role: 'user',
      status: 'active',
    });
  });

  it('แก้ displayName และ updatedAt ได้ (ตรงกับหน้า profile)', async () => {
    await assertSucceeds(
      updateDoc(doc(aliceDb(), 'users', ALICE.uid), { displayName: 'Alice 2', updatedAt: new Date() }),
    );
  });

  it('อัปเดต lastLogin ได้ (ตรงกับ flow Google sign-in)', async () => {
    await assertSucceeds(updateDoc(doc(aliceDb(), 'users', ALICE.uid), { lastLogin: new Date() }));
  });

  it('ห้ามเปลี่ยน role ของตัวเองเป็น admin (privilege escalation)', async () => {
    await assertFails(updateDoc(doc(aliceDb(), 'users', ALICE.uid), { role: 'admin' }));
  });

  it('ห้ามแอบเปลี่ยน role พร้อมกับฟิลด์ที่อนุญาต', async () => {
    await assertFails(
      updateDoc(doc(aliceDb(), 'users', ALICE.uid), { displayName: 'x', role: 'admin' }),
    );
  });

  it('ห้ามเขียนทับทั้งเอกสารด้วย setDoc เพื่อเปลี่ยน role', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), {
        uid: ALICE.uid,
        email: ALICE.email,
        displayName: 'Alice',
        role: 'admin',
        status: 'active',
      }),
    );
  });

  it('ห้ามลบฟิลด์ role ออก', async () => {
    await assertFails(
      setDoc(doc(aliceDb(), 'users', ALICE.uid), {
        uid: ALICE.uid,
        email: ALICE.email,
        displayName: 'Alice',
        status: 'active',
      }),
    );
  });

  it('ห้ามเปลี่ยน status ของตัวเอง (เช่นปลดการระงับบัญชี)', async () => {
    await seedUser(ALICE.uid, { email: ALICE.email, role: 'user', status: 'suspended' });
    await assertFails(updateDoc(doc(aliceDb(), 'users', ALICE.uid), { status: 'active' }));
  });

  it('ห้ามเปลี่ยน email เป็นค่าที่ไม่ตรงกับ ID token', async () => {
    await assertFails(
      updateDoc(doc(aliceDb(), 'users', ALICE.uid), { email: 'attacker@example.com' }),
    );
  });

  it('sync email ได้เมื่อ email ใหม่ตรงกับ ID token (เปลี่ยนผ่าน Firebase Auth แล้ว)', async () => {
    await seedUser(ALICE.uid, { email: 'old@example.com', role: 'user' });
    await assertSucceeds(updateDoc(doc(aliceDb(), 'users', ALICE.uid), { email: ALICE.email }));
  });

  it('ห้ามแก้เอกสารของผู้ใช้คนอื่น', async () => {
    await seedUser('bob', { email: 'bob@example.com', role: 'user' });
    await assertFails(updateDoc(doc(aliceDb(), 'users', 'bob'), { displayName: 'hacked' }));
  });
});

describe('users: สิทธิ์ของ admin', () => {
  beforeEach(async () => {
    await seedUser(ALICE.uid, { email: ALICE.email, role: 'user', status: 'active' });
  });

  it('admin เปลี่ยน role ของผู้ใช้อื่นได้ (ตรงกับ UserManagement)', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'users', ALICE.uid), { role: 'admin' }));
  });

  it('admin เปลี่ยน status ของผู้ใช้อื่นได้', async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), 'users', ALICE.uid), { status: 'suspended' }));
  });

  it('ผู้ใช้ที่ถูกเลื่อนเป็น admin โดย admin แล้ว จึงจะมีสิทธิ์ admin', async () => {
    await assertFails(getDoc(doc(aliceDb(), 'users', ADMIN.uid)));
    await updateDoc(doc(adminDb(), 'users', ALICE.uid), { role: 'admin' });
    await assertSucceeds(getDoc(doc(aliceDb(), 'users', ADMIN.uid)));
  });
});

describe('users: การอ่านและลบ', () => {
  beforeEach(async () => {
    await seedUser(ALICE.uid, { email: ALICE.email, role: 'user' });
    await seedUser('bob', { email: 'bob@example.com', role: 'user' });
  });

  it('อ่านเอกสารของตัวเองได้', async () => {
    await assertSucceeds(getDoc(doc(aliceDb(), 'users', ALICE.uid)));
  });

  it('อ่านเอกสารของผู้ใช้อื่นไม่ได้', async () => {
    await assertFails(getDoc(doc(aliceDb(), 'users', 'bob')));
  });

  it('ลบเอกสารของตัวเองได้ (หน้าลบบัญชี)', async () => {
    await assertSucceeds(deleteDoc(doc(aliceDb(), 'users', ALICE.uid)));
  });

  it('ลบเอกสารของผู้ใช้อื่นไม่ได้', async () => {
    await assertFails(deleteDoc(doc(aliceDb(), 'users', 'bob')));
  });
});
