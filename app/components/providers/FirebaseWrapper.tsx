'use client';

import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  onAuthStateChanged,
  updateProfile,
  User,
  GoogleAuthProvider
} from 'firebase/auth';
import { app, db, auth } from '@/app/lib/firebase';

// ใช้ GoogleAuthProvider จาก firebase/auth
const googleProvider = new GoogleAuthProvider();

// สร้าง context สำหรับใช้งาน Firebase
interface FirebaseContextType {
  app: typeof app;
  db: typeof db;
  auth: typeof auth;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getUserRole: (uid: string) => Promise<string>;
  setUserRole: (uid: string, role: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);


// สร้าง Provider component
export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    try {
      // ใช้ Firebase instances ที่สร้างไว้แล้วข้างนอก
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
    } catch (error) {
      console.error("Firebase initialization error:", error);
      setLoading(false);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Authentication methods
  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('ระบบ Firebase ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!auth) throw new Error('ระบบ Firebase ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
      // Update display name if provided
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        
        // เก็บข้อมูลผู้ใช้ในคอลเลกชัน users ใน Firestore พร้อมกำหนด role เป็น 'user'
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: displayName,
          role: 'user',
          createdAt: new Date(),
        });
      }
    } catch (error: any) {
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('ระบบ Firebase ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง');
    try {
      const result = await signInWithPopup(auth, googleProvider);
    
      // เก็บข้อมูลผู้ใช้ในคอลเลกชัน users ใน Firestore หากยังไม่มี
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userRef);
        
        // ตรวจสอบว่ามีข้อมูลผู้ใช้ในระบบแล้วหรือไม่
        if (userDoc.exists()) {
          if (process.env.NODE_ENV === 'development') {
            console.log('User already exists in Firestore');
          }
          // อัพเดทเฉพาะข้อมูลที่จำเป็น แต่ไม่เปลี่ยน role ที่มีอยู่แล้ว
          await updateDoc(userRef, {
            lastLogin: new Date()
          });
        } else {
          // ถ้ายังไม่มีข้อมูลผู้ใช้ ให้สร้างใหม่พร้อมกำหนด role เป็น 'user'
          if (process.env.NODE_ENV === 'development') {
            console.log('Creating new user in Firestore');
          }
          await setDoc(userRef, {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            role: 'user', // กำหนดค่าเริ่มต้นเป็น user
            status: 'active',
            createdAt: new Date(),
            lastLogin: new Date()
          });
        }
        
        // ดึงข้อมูล role ล่าสุดจาก Firestore
        const updatedUserDoc = await getDoc(userRef);
        if (updatedUserDoc.exists()) {
          if (process.env.NODE_ENV === 'development') {
            console.log('User role after sign in:', updatedUserDoc.data().role);
          }
        }
      }
    } catch (error: any) {
      throw error;
    }
  };

  const signOut = async () => {
    if (!auth) throw new Error('ระบบ Firebase ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง');
    try {
      return await firebaseSignOut(auth);
    } catch (error: any) {
      throw error;
    }
  };

  // ฟังก์ชันดึงข้อมูล role ของผู้ใช้จาก Firestore
  const getUserRole = async (uid: string): Promise<string> => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Getting user role for uid:', uid);
      }
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (process.env.NODE_ENV === 'development') {
          console.log('User data from Firestore:', userData);
        }
        return userData.role || 'user';
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('User document not found in Firestore');
        }
      }
      return 'user'; // ถ้าไม่พบข้อมูลให้คืนค่าเป็น user
    } catch (error) {
      // ส่ง error ต่อ ให้ผู้เรียกรู้ว่าอ่านไม่สำเร็จ (จะได้ไม่จำ role ผิดไว้ในแคช)
      console.error('Error getting user role:', error);
      throw error;
    }
  };

  // ฟังก์ชันอัพเดท role ของผู้ใช้ใน Firestore
  const setUserRole = async (uid: string, role: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      console.error('Error setting user role:', error);
      throw new Error('ไม่สามารถอัพเดทสิทธิ์ผู้ใช้ได้');
    }
  };

  // ถ้ากำลังเริ่มต้น ให้แสดง loading
  // ไม่บังทั้งหน้าด้วย spinner ระหว่างรอเช็กการล็อกอิน: หน้าเว็บแสดงผลได้ทันที (server render ได้จริง)
  // หน้าที่ต้องรู้สถานะล็อกอินใช้ `loading` จาก context เอง

  const value = {
    app,
    db,
    auth,
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    getUserRole,
    setUserRole
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

// สร้าง hook สำหรับใช้งาน Firebase
export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
} 