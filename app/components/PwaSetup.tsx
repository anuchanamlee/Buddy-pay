'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/app/lib/pwa';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

declare global {
  interface Window {
    __buddypayInstallPrompt?: InstallPromptEvent | null;
  }
}

/** ลงทะเบียน service worker และเก็บปุ่ม "ติดตั้งแอป" ของ Android ไว้ให้หน้า /install ใช้ */
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') void registerServiceWorker();

    const onPrompt = (e: Event) => {
      e.preventDefault(); // ไม่ให้ Chrome เด้งแถบติดตั้งเอง ให้ผู้ใช้กดจากปุ่มของเรา
      window.__buddypayInstallPrompt = e as InstallPromptEvent;
      window.dispatchEvent(new Event('buddypay:installable'));
    };
    const onInstalled = () => {
      window.__buddypayInstallPrompt = null;
      window.dispatchEvent(new Event('buddypay:installable'));
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}
