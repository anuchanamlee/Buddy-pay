import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth';
import localforage from 'localforage';

/**
 * collection ที่เก็บข้อมูลของผู้ใช้ผ่านฟิลด์ userId และเจ้าของลบเองได้ตาม firestore.rules
 * ถ้าเพิ่ม collection ใหม่ที่ผูกกับผู้ใช้ ต้องเพิ่มที่นี่ด้วย ไม่อย่างนั้นข้อมูลจะค้างหลังลบบัญชี
 */
export const USER_OWNED_COLLECTIONS = ['bills', 'participantGroups', 'billActivities'] as const;

const BATCH_SIZE = 400; // writeBatch รับได้สูงสุด 500 operation

/** วิธีล็อกอินของบัญชี ใช้ตัดสินว่าต้องยืนยันตัวตนด้วยรหัสผ่านหรือ Google */
export function getSignInMethod(user: Pick<User, 'providerData'>): 'password' | 'google' | 'other' {
  const ids = user.providerData.map((p) => p.providerId);
  if (ids.includes('password')) return 'password';
  if (ids.includes('google.com')) return 'google';
  return 'other';
}

/** ยืนยันตัวตนอีกครั้งก่อนทำเรื่องสำคัญ (Firebase บังคับก่อนลบบัญชีหรือเปลี่ยนรหัสผ่าน) */
export async function reauthenticate(user: User, password?: string): Promise<void> {
  const method = getSignInMethod(user);
  if (method === 'password') {
    if (!user.email || !password) throw Object.assign(new Error('missing password'), { code: 'auth/missing-password' });
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return;
  }
  if (method === 'google') {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return;
  }
  throw Object.assign(new Error('unsupported provider'), { code: 'auth/unsupported-provider' });
}

/** ลบเอกสารทั้งหมดของผู้ใช้ใน collection เดียว ทีละชุด คืนจำนวนที่ลบ */
async function deleteOwnedDocs(db: Firestore, collectionName: string, uid: string): Promise<number> {
  let deleted = 0;
  // วนจนไม่เหลือ เพราะ query ดึงได้ทีละ BATCH_SIZE
  for (;;) {
    const snap = await getDocs(query(collection(db, collectionName), where('userId', '==', uid), limit(BATCH_SIZE)));
    if (snap.empty) return deleted;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < BATCH_SIZE) return deleted;
  }
}

/**
 * ลบข้อมูลทั้งหมดของผู้ใช้ใน Firestore และแคชในเครื่อง (ไม่ลบบัญชี Auth)
 * เรียกหลัง reauthenticate และก่อน deleteUser เพราะหลังลบบัญชีแล้วจะไม่มีสิทธิ์ลบข้อมูลอีก
 */
export async function deleteUserData(db: Firestore, uid: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const name of USER_OWNED_COLLECTIONS) {
    counts[name] = await deleteOwnedDocs(db, name, uid);
  }
  await deleteDoc(doc(db, 'users', uid));
  try {
    await localforage.removeItem(`bills_${uid}`);
  } catch {
    // แคชในเครื่องลบไม่ได้ก็ไม่เป็นไร ข้อมูลจริงถูกลบแล้ว
  }
  return counts;
}

/** ลบบัญชีแบบครบ: ยืนยันตัวตน → ลบข้อมูลทั้งหมด → ลบบัญชี Auth */
export async function deleteAccountCompletely(db: Firestore, user: User, password?: string): Promise<void> {
  await reauthenticate(user, password);
  await deleteUserData(db, user.uid);
  await deleteUser(user);
}
