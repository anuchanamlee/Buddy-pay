import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Firebase Admin SDK สำหรับใช้ฝั่ง server เท่านั้น
 *
 * การ verify ID token ใช้แค่ projectId (ตรวจลายเซ็นกับ public key ของ Google)
 * จึงไม่ต้องใช้ service account สำหรับงานนี้
 * initialize แบบ lazy เพื่อไม่ให้ build พังเมื่อยังไม่ได้ตั้งค่า environment
 */
function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }
  return initializeApp({ projectId });
}

export async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string }> {
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  return { uid: decoded.uid };
}
