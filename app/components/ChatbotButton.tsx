'use client';

import { useState, useEffect } from 'react';
import ChatbotPopup from './ChatbotPopup';

type ChatbotButtonProps = {
  position?: 'bottom-right' | 'bottom-left';
  botName?: string;
  primaryColor?: string;
};

export default function ChatbotButton(props: ChatbotButtonProps) {
  // สถานะสำหรับเช็คว่าเราอยู่บนฝั่ง client หรือไม่ (เพื่อป้องกัน SSR errors)
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // ถ้าอยู่ที่ server ให้ return null เพื่อไม่ให้มีการ render ผิดพลาด
  if (!isClient) return null;

  return <ChatbotPopup {...props} />;
} 