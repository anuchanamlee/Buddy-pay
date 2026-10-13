"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useFirebase } from '../components/providers/FirebaseWrapper';
import { getErrorMessage, logErrorToAnalytics } from '../lib/errorMessages';

import Cookies from 'js-cookie';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from './ToastContext';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  error: string | null;
  setError: (error: string | null) => void;
  userRole: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  loginWithGoogle: async () => {},
  error: null,
  setError: () => {},
  userRole: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();
  const { auth, signIn, signUp, signOut, signInWithGoogle, getUserRole } = useFirebase();
  const { showToast } = useToast();

  // ตรวจสอบสถานะการล็อกอินเมื่อคอมโพเนนต์โหลด
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("Auth state changed. User:", user?.email);
      }
      setUser(user);
      setLoading(false);
      
      if (user) {
        try {
          Cookies.set('firebase-session', 'true', { secure: true, sameSite: 'strict' });
          
          if (process.env.NODE_ENV === 'development') {
            console.log("Fetching role for user:", user.uid);
          }
          // ใช้ role ที่เคยอ่านในแท็บนี้ ไม่ต้องอ่าน Firestore ทุกครั้งที่เปลี่ยนหน้า (Rules ยังตรวจสิทธิ์จริงทุกครั้ง)
          const cacheKey = `userRole:${user.uid}`;
          const role = sessionStorage.getItem(cacheKey) || (await getUserRole(user.uid));
          sessionStorage.setItem(cacheKey, role);
          if (process.env.NODE_ENV === 'development') {
            }
          setUserRole(role);
          
          sessionStorage.setItem('userRole', role);
          Cookies.set('user-role', role, { secure: true, sameSite: 'strict' });
        } catch (error) {
          console.error('Error getting user role:', error);
          setUserRole('user');
          sessionStorage.setItem('userRole', 'user');
          Cookies.set('user-role', 'user', { secure: true, sameSite: 'strict' });
        }
      } else {
        setUserRole(null);
        sessionStorage.removeItem('userRole');
        Cookies.remove('firebase-session');
        Cookies.remove('user-role');
      }
    });

    return () => unsubscribe();
  }, [auth, getUserRole]);

  // ฟังก์ชันล็อกอินด้วยอีเมลและรหัสผ่าน
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      await signIn(email, password);
      // หมายเหตุ: บทบาทจะถูกดึงและตั้งค่าในตัวจัดการ onAuthStateChanged
      
      // แสดงการแจ้งเตือน
      showToast('เข้าสู่ระบบสำเร็จ', 'success');
      
      // ดึง returnUrl จาก sessionStorage ถ้ามี
      const returnUrl = sessionStorage.getItem('returnUrl') || '/';
      sessionStorage.removeItem('returnUrl');
      router.push(returnUrl);
      router.refresh();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      
      // แสดงการแจ้งเตือนข้อผิดพลาดที่เป็นมิตรกับผู้ใช้
      showToast(errorMessage, 'error');
      
      // บันทึก error เพื่อการวิเคราะห์
      logErrorToAnalytics(error.code || 'login-error', error.message, { email, timestamp: new Date().toISOString() });
      
      throw error;
    }
  };

  // ฟังก์ชันสมัครสมาชิกด้วยอีเมลและรหัสผ่าน
  const signup = async (email: string, password: string, name: string) => {
    try {
      setError(null);
      await signUp(email, password, name);
      // หมายเหตุ: บทบาทจะถูกดึงและตั้งค่าในตัวจัดการ onAuthStateChanged
      
      // แสดงการแจ้งเตือน
      showToast('สมัครสมาชิกและเข้าสู่ระบบสำเร็จ', 'success');
      
      // ดึง returnUrl จาก sessionStorage ถ้ามี
      const returnUrl = sessionStorage.getItem('returnUrl') || '/';
      sessionStorage.removeItem('returnUrl');
      router.push(returnUrl);
      router.refresh();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      
      // แสดงการแจ้งเตือนข้อผิดพลาดที่เป็นมิตรกับผู้ใช้
      showToast(errorMessage, 'error');
      
      // บันทึก error เพื่อการวิเคราะห์
      logErrorToAnalytics(error.code || 'signup-error', error.message, { email, name, timestamp: new Date().toISOString() });
      
      throw error;
    }
  };

  // ฟังก์ชันล็อกอินด้วย Google
  const loginWithGoogle = async () => {
    try {
      setError(null);
      await signInWithGoogle();
      // หมายเหตุ: บทบาทจะถูกดึงและตั้งค่าในตัวจัดการ onAuthStateChanged
      
      // แสดงการแจ้งเตือน
      showToast('เข้าสู่ระบบด้วย Google สำเร็จ', 'success');
      
      // ดึง returnUrl จาก sessionStorage ถ้ามี
      const returnUrl = sessionStorage.getItem('returnUrl') || '/';
      sessionStorage.removeItem('returnUrl');
      router.push(returnUrl);
      router.refresh();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      
      // แสดงการแจ้งเตือนข้อผิดพลาดที่เป็นมิตรกับผู้ใช้
      showToast(errorMessage, 'error');
      
      // บันทึก error เพื่อการวิเคราะห์
      logErrorToAnalytics(error.code || 'google-login-error', error.message, { provider: 'google', timestamp: new Date().toISOString() });
      
      throw error;
    }
  };

  // ฟังก์ชันล็อกเอาท์
  const logout = async () => {
    try {
      await signOut();
      
      // แสดงการแจ้งเตือน
      showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
      
      // ล้าง userRole (รวม role ที่แคชไว้ต่อ uid) จาก sessionStorage และ cookies
      sessionStorage.removeItem('userRole');
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('userRole:'))
        .forEach((k) => sessionStorage.removeItem(k));
      Cookies.remove('firebase-session');
      Cookies.remove('user-role');
      setUserRole(null);

      // ลบข้อมูลบิลที่แคชไว้ในเครื่อง (กันคนที่ใช้เครื่องต่อเห็นข้อมูล) แล้วโหลดหน้าใหม่ให้ Firestore เริ่มใหม่
      try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
      } catch {
        // ลบไม่ได้ (เช่นแท็บอื่นยังเปิดอยู่) ข้อมูลยังถูกป้องกันด้วย query ที่กรอง userId
      }
      window.location.assign('/');
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      
      // แสดงการแจ้งเตือนข้อผิดพลาดที่เป็นมิตรกับผู้ใช้
      showToast(errorMessage, 'error');
      
      // บันทึก error เพื่อการวิเคราะห์
      logErrorToAnalytics(error.code || 'logout-error', error.message, { timestamp: new Date().toISOString() });
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    loginWithGoogle,
    error,
    setError,
    userRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 