'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, X, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';

type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { login, signup, loginWithGoogle } = useAuth();
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // ส่งอีเมลรีเซ็ตรหัสผ่าน ใช้ข้อความเดียวกันทุกกรณีเพื่อไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่
  const handleForgotPassword = async () => {
    setError(null);
    setResetMessage(null);
    if (!email) {
      setError('กรอกอีเมลก่อน แล้วกด "ลืมรหัสผ่าน" อีกครั้ง');
      return;
    }
    try {
      if (auth) await sendPasswordResetEmail(auth, email);
    } catch {
      // ไม่แสดงรายละเอียด error เพื่อไม่เปิดเผยว่ามีบัญชีหรือไม่
    }
    setResetMessage('ถ้าอีเมลนี้มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว');
  };

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      resetForm();
    }
  }, [initialMode, isOpen]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setError(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loginWithGoogle();
      handleClose();
    } catch (error: any) {
      setError(error.message || 'การลงชื่อเข้าใช้ด้วย Google ล้มเหลว');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      setIsLoading(true);
      
      if (mode === 'signup') {
        // Validate fields
        if (!displayName || !email || !password || !confirmPassword) {
          throw new Error('กรุณากรอกข้อมูลให้ครบทุกช่อง');
        }
        
        if (password !== confirmPassword) {
          throw new Error('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
        }
        
        if (password.length < 6) {
          throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        }
        
        await signup(email, password, displayName);
      } else {
        // Login
        if (!email || !password) {
          throw new Error('กรุณากรอกอีเมลและรหัสผ่าน');
        }
        
        await login(email, password);
      }
      
      handleClose();
    } catch (error: any) {
      let errorMessage = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      
      // Handle Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Return null if modal is not open
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          
          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
              aria-label="ปิด"
            >
              <X size={20} />
            </button>
            
            {/* Header */}
            <div className="bg-primary p-6 text-white">
              <h2 className="text-2xl font-bold">
                {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
              </h2>
              <p className="mt-1 text-sm opacity-90">
                {mode === 'login' 
                  ? 'ยินดีต้อนรับกลับ! กรุณาเข้าสู่ระบบเพื่อใช้งาน'
                  : 'สร้างบัญชีใหม่เพื่อเริ่มใช้งาน LastBuddyPay'
                }
              </p>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Error message */}
              {error && (
                <div className="mb-4 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <Input
                    label="ชื่อที่แสดง"
                    placeholder="ชื่อของคุณ"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    leftElement={<User size={16} />}
                    required
                    autoComplete="name"
                  />
                )}
                
                <Input
                  label="อีเมล"
                  type="email"
                  placeholder="yourname@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftElement={<Mail size={16} />}
                  required
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                />
                
                <Input
                  label="รหัสผ่าน"
                  type="password"
                  placeholder={mode === 'login' ? 'รหัสผ่านของคุณ' : 'สร้างรหัสผ่าน (อย่างน้อย 6 ตัว)'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftElement={<Lock size={16} />}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                
                {mode === 'signup' && (
                  <Input
                    label="ยืนยันรหัสผ่าน"
                    type="password"
                    placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftElement={<Lock size={16} />}
                    error={confirmPassword && password !== confirmPassword ? 'รหัสผ่านไม่ตรงกัน' : undefined}
                    required
                    autoComplete="new-password"
                  />
                )}
                
                {mode === 'login' && (
                  <div className="-mt-1 text-right">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="inline-flex min-h-[44px] items-center px-1 text-sm font-medium text-primary hover:underline"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                )}
                {resetMessage && (
                  <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    {resetMessage}
                  </p>
                )}

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
                </Button>
              </form>
              
              <div className="my-4 flex items-center">
                <div className="flex-1 border-t border-gray-200"></div>
                <div className="px-2 text-sm text-gray-500">หรือ</div>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>
              
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleGoogleSignIn}
                isLoading={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
                  <path
                    fill="#FFC107"
                    d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                  />
                </svg>
                เข้าสู่ระบบด้วย Google
              </Button>
              
              <div className="mt-5 text-center text-sm">
                {mode === 'login' ? (
                  <p>
                    ยังไม่มีบัญชี?{' '}
                    <button
                      type="button"
                      onClick={switchMode}
                      className="inline-flex min-h-[44px] items-center px-1 font-medium text-primary hover:underline"
                    >
                      สมัครสมาชิก
                    </button>
                  </p>
                ) : (
                  <p>
                    มีบัญชีอยู่แล้ว?{' '}
                    <button
                      type="button"
                      onClick={switchMode}
                      className="inline-flex min-h-[44px] items-center px-1 font-medium text-primary hover:underline"
                    >
                      เข้าสู่ระบบ
                    </button>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
} 