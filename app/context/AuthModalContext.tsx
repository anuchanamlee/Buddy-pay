'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import AuthModal from '../components/AuthModal';

type AuthMode = 'login' | 'signup';

interface AuthModalContextType {
  isAuthModalOpen: boolean;
  openLoginModal: () => void;
  openSignupModal: () => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType>({
  isAuthModalOpen: false,
  openLoginModal: () => {},
  openSignupModal: () => {},
  closeAuthModal: () => {},
});

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login');

  const openLoginModal = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const openSignupModal = () => {
    setAuthModalMode('signup');
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  // middleware ส่งผู้ใช้ที่ยังไม่ล็อกอินมาที่ /?login=1&from=<path>
  // เปิด modal ล็อกอินให้ และจำหน้าเดิมไว้ให้ login() พากลับไปหลังล็อกอินสำเร็จ
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') !== '1') return;

    const from = params.get('from');
    // รับเฉพาะ path ภายในเว็บ กัน open redirect ไปโดเมนอื่น
    if (from && from.startsWith('/') && !from.startsWith('//')) {
      sessionStorage.setItem('returnUrl', from);
    }
    setAuthModalMode('login');
    setIsAuthModalOpen(true);

    params.delete('login');
    params.delete('from');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);

  return (
    <AuthModalContext.Provider
      value={{
        isAuthModalOpen,
        openLoginModal,
        openSignupModal,
        closeAuthModal,
      }}
    >
      {children}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
      />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  return useContext(AuthModalContext);
} 