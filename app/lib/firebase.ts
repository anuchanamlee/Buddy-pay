import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase configuration
// ต้องอ้าง process.env.NEXT_PUBLIC_* ตรง ๆ เพราะ Next.js แทนค่าเหล่านี้ลงใน bundle ตอน build
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// ค่าขั้นต่ำที่ทำให้ getAuth() และ getFirestore() initialize ได้ (ถ้าขาด SDK จะ throw ทันที)
// ค่าอื่น เช่น AUTH_DOMAIN ยังจำเป็นสำหรับบางฟีเจอร์ (Google Sign-in) แต่ไม่ทำให้ initialize ล้มเหลว
const REQUIRED_CONFIG = {
  NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
};

export const missingFirebaseConfig = Object.entries(REQUIRED_CONFIG)
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const isFirebaseConfigured = missingFirebaseConfig.length === 0;

const isBrowser = typeof window !== 'undefined';

// ใน browser ต้องมี config ครบเสมอ ถ้าไม่ครบให้แจ้งชื่อตัวแปรที่ขาดอย่างชัดเจน
if (!isFirebaseConfigured && isBrowser) {
  throw new Error(`Firebase config is missing: ${missingFirebaseConfig.join(', ')}`);
}

// ฝั่ง server (เช่นตอน `next build` เก็บข้อมูลหน้าและ prerender) จะไม่ initialize
// Firebase client SDK ถ้า config ไม่ครบ เดิม getAuth() จะ throw auth/invalid-api-key
// ตั้งแต่ตอน import ทำให้ build ล้มเหลว ทั้งที่หน้าเว็บไม่ได้ใช้ Firebase ระหว่าง SSR
// (FirebaseProvider แสดง loading จนกว่า onAuthStateChanged จะทำงานใน browser)
// ค่าที่ export จะเป็น undefined ในกรณีนี้ โค้ดฝั่ง server ที่ใช้จึงต้องตรวจ `if (!db)` ก่อน
function initializeFirebase() {
  if (!isFirebaseConfigured) {
    return {
      app: undefined as unknown as FirebaseApp,
      auth: undefined as unknown as Auth,
      db: undefined as unknown as Firestore,
      storage: undefined as unknown as FirebaseStorage,
    };
  }

  const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return {
    app: firebaseApp,
    auth: getAuth(firebaseApp),
    db: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp),
  };
}

const firebase = initializeFirebase();

// คืนค่า Firebase Auth
export const getFirebaseAuth = (): Auth => firebase.auth;

// ส่งออก Firebase app และบริการ
export const app = firebase.app;
export const auth = firebase.auth;
export const db = firebase.db;
export const storage = firebase.storage;

// ฟังก์ชันสำหรับตรวจสอบข้อมูลผู้ใช้ในฐานข้อมูล (สำหรับการดีบัก)
export const debugUserRole = async (uid: string) => {
  try {
    if (!db) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Firestore not initialized');
      }
      return null;
    }
    
    const { getDoc, doc } = await import('firebase/firestore');
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (userDoc.exists()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('DEBUG - User data from Firestore:', userDoc.data());
      }
      return userDoc.data();
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('DEBUG - User not found in Firestore');
      }
      return null;
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('DEBUG - Error getting user data:', error);
    }
    return null;
  }
};

export default app; 