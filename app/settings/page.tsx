'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { Check, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db } from '@/app/lib/firebase';
import { deleteAccountCompletely, getSignInMethod } from '@/app/lib/services/accountDeletion';
import { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { PageLoader } from '@/app/components/ui/PageLoader';
import { LoadingButton } from '@/app/components/ui/LoadingButton';

export default function SettingsPage() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    // ตรวจสอบการกรอกข้อมูล
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      setIsLoading(false);
      return;
    }

    try {
      if (user && user.email) {
        // สร้าง credential สำหรับการยืนยันตัวตน
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        
        // ยืนยันตัวตนก่อนเปลี่ยนรหัสผ่าน
        await reauthenticateWithCredential(user as User, credential);
        
        // เปลี่ยนรหัสผ่าน
        await updatePassword(user as User, newPassword);
        
        // รีเซ็ตฟอร์ม
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        
        setIsSuccess(true);
        
        // รีเซ็ตสถานะความสำเร็จหลังจาก 3 วินาที
        setTimeout(() => {
          setIsSuccess(false);
        }, 3000);
      }
    } catch (err: any) {
      let errorMessage = 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน';
      
      if (err.code === 'auth/wrong-password') {
        errorMessage = 'รหัสผ่านปัจจุบันไม่ถูกต้อง';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'รหัสผ่านใหม่ไม่ปลอดภัยเพียงพอ';
      } else if (err.code === 'auth/requires-recent-login') {
        errorMessage = 'กรุณาเข้าสู่ระบบใหม่เพื่อดำเนินการนี้';
        // ออกจากระบบและนำทางไปยังหน้าล็อกอิน
        await logout();
        router.push('/');
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      // ยืนยันตัวตน → ลบบิล กลุ่ม กิจกรรม และข้อมูลผู้ใช้ทั้งหมด → ลบบัญชี
      await deleteAccountCompletely(db, user as User, deletePassword || undefined);
      sessionStorage.removeItem('userRole');
      Cookies.remove('firebase-session');
      Cookies.remove('user-role');
      router.push('/');
    } catch (err: any) {
      let errorMessage = 'เกิดข้อผิดพลาดในการลบบัญชี กรุณาลองใหม่';

      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = 'รหัสผ่านไม่ถูกต้อง';
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        errorMessage = 'ยกเลิกการยืนยันตัวตนกับ Google แล้ว บัญชียังไม่ถูกลบ';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'เบราว์เซอร์บล็อกหน้าต่างยืนยันตัวตน กรุณาอนุญาต popup แล้วลองใหม่';
      } else if (err.code === 'auth/user-mismatch') {
        errorMessage = 'บัญชี Google ที่เลือกไม่ตรงกับบัญชีที่ล็อกอินอยู่';
      } else if (err.code === 'auth/requires-recent-login') {
        errorMessage = 'กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่ก่อนลบบัญชี';
      }

      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // แสดงหน้าโหลดถ้ากำลังตรวจสอบสถานะการล็อกอิน
  if (authLoading) {
    return (
      <PageLoader 
        message="กำลังโหลดข้อมูลการตั้งค่า..." 
        overlay={true}
      />
    );
  }

  // ถ้าไม่ได้ล็อกอิน ให้กลับหน้าแรกพร้อมเปิด modal ล็อกอิน แล้วพากลับมาหน้านี้หลังล็อกอิน
  if (!isAuthenticated) {
    router.replace('/?login=1&from=/settings');
    return null;
  }

  const signInMethod = user ? getSignInMethod(user as User) : 'other';
  const usesPassword = signInMethod === 'password';
  const canConfirmDelete = usesPassword ? !!deletePassword : deleteConfirmText.trim() === 'ลบบัญชี';

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 mt-16">
      <h1 className="text-3xl font-bold mb-6">ตั้งค่าบัญชี</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* เมนูด้านซ้าย */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>เมนู</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="flex flex-col">
                <Link 
                  href="/profile" 
                  className="px-4 py-2 border-l-2 border-transparent hover:border-primary/50 hover:bg-primary/5"
                >
                  โปรไฟล์
                </Link>
                <Link 
                  href="/bill-history" 
                  className="px-4 py-2 border-l-2 border-transparent hover:border-primary/50 hover:bg-primary/5"
                >
                  ประวัติบิล
                </Link>
                <Link 
                  href="/settings" 
                  className="px-4 py-2 border-l-2 border-primary bg-primary/5 font-medium"
                >
                  ตั้งค่าบัญชี
                </Link>
              </nav>
            </CardContent>
          </Card>
        </div>
        
        {/* คอนเทนต์หลัก */}
        <div className="md:col-span-2 space-y-6">
          {/* เปลี่ยนรหัสผ่าน: เฉพาะบัญชีที่ล็อกอินด้วยอีเมลและรหัสผ่าน */}
          {!usesPassword ? (
            <Card>
              <CardHeader>
                <CardTitle>รหัสผ่าน</CardTitle>
                <CardDescription>
                  บัญชีนี้เข้าสู่ระบบด้วย Google จึงไม่มีรหัสผ่านของ BuddyPay จัดการความปลอดภัยได้ที่บัญชี Google ของคุณ
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>เปลี่ยนรหัสผ่าน</CardTitle>
              <CardDescription>อัปเดตรหัสผ่านเพื่อความปลอดภัย</CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordChange}>
              <CardContent className="space-y-4">
                {/* แสดงข้อความผิดพลาด */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}
                
                {/* แสดงข้อความสำเร็จ */}
                {isSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <Check size={18} />
                    <span>เปลี่ยนรหัสผ่านสำเร็จ</span>
                  </div>
                )}
                
                <div>
                  <Input
                    type="password"
                    label="รหัสผ่านปัจจุบัน"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านปัจจุบัน"
                    required
                  />
                </div>
                
                <div>
                  <Input
                    type="password"
                    label="รหัสผ่านใหม่"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                    required
                    minLength={6}
                  />
                </div>
                
                <div>
                  <Input
                    type="password"
                    label="ยืนยันรหัสผ่านใหม่"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    required
                    error={confirmPassword && newPassword !== confirmPassword ? "รหัสผ่านไม่ตรงกัน" : undefined}
                  />
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-end">
                <LoadingButton
                  type="submit"
                  loading={isLoading}
                  loadingText="กำลังบันทึก..."
                >
                  เปลี่ยนรหัสผ่าน
                </LoadingButton>
              </CardFooter>
            </form>
          </Card>
          )}
          
          {/* ลบบัญชี */}
          <Card className="border-red-200">
            <CardHeader className="text-red-600">
              <CardTitle className="flex items-center gap-2">
                <Trash2 size={18} />
                ลบบัญชี
              </CardTitle>
              <CardDescription className="text-red-500">
                การดำเนินการนี้ไม่สามารถย้อนกลับได้ บัญชีและข้อมูลทั้งหมดของคุณจะถูกลบอย่างถาวร
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showDeleteConfirm ? (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  ลบบัญชีของฉัน
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">คำเตือน: การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
                      <p className="text-sm mt-1">
                        บิล กลุ่มเพื่อน และประวัติทั้งหมดของคุณจะถูกลบอย่างถาวร{' '}
                        {usesPassword ? 'กรุณากรอกรหัสผ่านเพื่อยืนยัน' : 'พิมพ์คำว่า "ลบบัญชี" แล้วยืนยันตัวตนกับ Google อีกครั้ง'}
                      </p>
                    </div>
                  </div>
                  
                  {deleteError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                      <AlertCircle size={18} />
                      <span>{deleteError}</span>
                    </div>
                  )}
                  
                  <form onSubmit={handleDeleteAccount} className="space-y-4">
                    {usesPassword ? (
                      <Input
                        type="password"
                        label="รหัสผ่าน"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="กรอกรหัสผ่านเพื่อยืนยัน"
                        required
                      />
                    ) : (
                      <Input
                        type="text"
                        label='พิมพ์ "ลบบัญชี" เพื่อยืนยัน'
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="ลบบัญชี"
                        autoComplete="off"
                        required
                      />
                    )}
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <LoadingButton
                        type="submit"
                        variant="danger"
                        loading={isDeleting}
                        disabled={!canConfirmDelete}
                        loadingText="กำลังลบบัญชี..."
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {usesPassword ? 'ยืนยันการลบบัญชี' : 'ยืนยันกับ Google แล้วลบบัญชี'}
                      </LoadingButton>
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeletePassword('');
                          setDeleteConfirmText('');
                          setDeleteError(null);
                        }}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 